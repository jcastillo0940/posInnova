import AppSidebar from '@/Components/AppSidebar';
import { PageProps } from '@/types';
import { formatMoney, usdToCrc } from '@/lib/money';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { enqueueOfflineItem, readPosSnapshot, savePosSnapshot, syncOfflineQueue } from '@/lib/offlineQueue';

type Product = {
    id: number;
    name: string;
    barcode: string;
    price: number;
    stock: number;
    category: string | null;
};

type Customer = {
    id: number;
    name: string;
    document: string | null;
    credit_limit: number;
    credit_balance: number;
    status: string;
};

type PendingSale = {
    id: number;
    number: string;
    total: number;
    paid_amount: number;
    balance: number;
    created_at: string | null;
};

type PendingSalesSnapshot = {
    customerId: number;
    sales: PendingSale[];
    customer: {
        id: number;
        name: string;
        document: string | null;
        credit_balance: number;
    };
    capturedAt: string;
};

type RecentSale = {
    id: number;
    number: string;
    total: string;
    status: string;
    created_at: string | null;
};

type Props = {
    openSession: null | {
        id: number;
        cashRegister: string | null;
        branch: string | null;
        user: string | null;
        status: string;
        openedAt: string | null;
        openingFloat: number;
        currentCash: number;
    };
    currency: string;
    exchangeRateUsdCrc: number;
    autoPrintReceipts: boolean;
    productsCount: number;
    productsLowStock: number;
    recentSales: RecentSale[];
    approvalRequests?: Array<{
        id: number;
        sale_id: number | null;
        sale_number: string | null;
        type: string;
        status: string;
        requested_amount: number | null;
        approved_amount: number | null;
        decision_notes: string | null;
        reason: string | null;
        decided_at: string | null;
    }>;
    products: Product[];
    customers: Customer[];
    priceLists: Array<{ id: number; name: string; type: string; multiplier: number }>;
    promotions: Array<{ id: number; name: string; type: string; value: number; buy_qty: number; get_qty: number }>;
    flash?: {
        success?: string | null;
        error?: string | null;
        credit_payment_ticket?: number | null;
    };
};

type CartItem = {
    product_id: number;
    name: string;
    barcode: string;
    price: number;
    quantity: number;
};

type PausedSale = {
    id: string;
    label: string;
    cart: CartItem[];
    customerId: number | '';
    saleMode: SaleMode;
    discountTotal: string;
    priceListId: number | '';
    promotionId: number | '';
    cashPaid: string;
    cardPaid: string;
    creditPaid: string;
    usdPaid: string;
    notes: string;
};

type SaleMode = 'cash' | 'credit' | 'layaway' | 'quote';
type PaymentFlow = 'cash' | 'credit' | 'mixed';

export default function Dashboard({ openSession, products, customers, priceLists, promotions, currency, exchangeRateUsdCrc, autoPrintReceipts, flash, recentSales, approvalRequests = [] }: Props) {
    const { processing } = useForm({});
    const page = usePage<PageProps>().props as PageProps & { approvals?: { pendingCount?: number } };
    const { permissions } = page.auth;
    const pendingApprovals = page.approvals?.pendingCount ?? 0;
    const searchRef = useRef<HTMLInputElement | null>(null);
    const customerSearchRef = useRef<HTMLInputElement | null>(null);
    const printTicketWindow = useRef<Window | null>(null);
    const [query, setQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [saleMode, setSaleMode] = useState<SaleMode>('cash');
    const [customerId, setCustomerId] = useState<number | ''>('');
    const [discountTotal, setDiscountTotal] = useState('0.00');
    const [priceListId, setPriceListId] = useState<number | ''>('');
    const [promotionId, setPromotionId] = useState<number | ''>('');
    const [cashPaid, setCashPaid] = useState('');
    const [cardPaid, setCardPaid] = useState('');
    const [creditPaid, setCreditPaid] = useState('');
    const [usdPaid, setUsdPaid] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
    const [paymentFlow, setPaymentFlow] = useState<PaymentFlow>('cash');
    const [paymentCustomerQuery, setPaymentCustomerQuery] = useState('');
    const [paymentError, setPaymentError] = useState('');
    const [customerQuery, setCustomerQuery] = useState('');
    const [invoiceCustomerQuery, setInvoiceCustomerQuery] = useState('');
    const [invoiceMode, setInvoiceMode] = useState<'auto' | 'manual'>('auto');
    const [invoiceAmount, setInvoiceAmount] = useState('');
    const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
    const [invoiceAppliedAmounts, setInvoiceAppliedAmounts] = useState<Record<number, string>>({});
    const [pausedSales, setPausedSales] = useState<PausedSale[]>(() => {
        if (typeof window === 'undefined') return [];

        try {
            const raw = window.localStorage.getItem('pos.paused-sales');
            return raw ? JSON.parse(raw) as PausedSale[] : [];
        } catch {
            return [];
        }
    });
    const [activePauseId, setActivePauseId] = useState<string | null>(null);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerDocument, setNewCustomerDocument] = useState('');
    const [newCustomerLimit, setNewCustomerLimit] = useState('');
    const [statusBanner, setStatusBanner] = useState<string | null>(null);
    const [approvalModalOpen, setApprovalModalOpen] = useState(false);
    const [approvalWatchSale, setApprovalWatchSale] = useState<string | null>(null);
    const [approvalWatchResolved, setApprovalWatchResolved] = useState<string | null>(null);
    const [approvalWatchState, setApprovalWatchState] = useState<'pending_approval' | 'approved' | 'rejected' | null>(null);
    const [selectedApprovalSale, setSelectedApprovalSale] = useState<string | null>(null);
    const [approvedSaleToFinalize, setApprovedSaleToFinalize] = useState<number | null>(null);
    const approvalSound = useRef<AudioContext | null>(null);
    const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
    const snapshot = readPosSnapshot<{
        products: Product[];
        customers: Customer[];
        priceLists: Array<{ id: number; name: string; type: string; multiplier: number }>;
        promotions: Array<{ id: number; name: string; type: string; value: number; buy_qty: number; get_qty: number }>;
        exchangeRateUsdCrc: number;
        currency: string;
        pendingSalesByCustomer?: Record<string, PendingSalesSnapshot>;
    }>();

    const catalogProducts = isOnline ? products : (snapshot?.products ?? products);
    const catalogCustomers = isOnline ? customers : (snapshot?.customers ?? customers);
    const catalogPriceLists = isOnline ? priceLists : (snapshot?.priceLists ?? priceLists);
    const catalogPromotions = isOnline ? promotions : (snapshot?.promotions ?? promotions);
    const effectiveExchangeRate = isOnline ? exchangeRateUsdCrc : (snapshot?.exchangeRateUsdCrc ?? exchangeRateUsdCrc);
    const effectiveCurrency = isOnline ? currency : (snapshot?.currency ?? currency);
    const selectedPriceList = catalogPriceLists.find((priceList) => priceList.id === priceListId) ?? null;
    const selectedPromotion = catalogPromotions.find((promotion) => promotion.id === promotionId) ?? null;
    const selectedCustomer = catalogCustomers.find((customer) => customer.id === customerId) ?? null;
    const priceMultiplier = selectedPriceList?.multiplier ?? 1;
    const money = (value: number | string) => formatMoney(value, effectiveCurrency);
    const usdMoney = (value: number | string) => formatMoney(value, 'USD');
    const moneyInput = (value: number | string) => Number(value || 0).toFixed(effectiveCurrency === 'CRC' ? 0 : 2);
    const normalizedCustomerQuery = customerQuery.trim().toLowerCase();
    const matchedCustomers = customers.filter((customer) => {
        const haystack = `${customer.name} ${customer.document ?? ''}`.toLowerCase();
        return !normalizedCustomerQuery || haystack.includes(normalizedCustomerQuery);
    });
    const paymentCustomerMatches = customers.filter((customer) => {
        const haystack = `${customer.name} ${customer.document ?? ''}`.toLowerCase();
        const term = paymentCustomerQuery.trim().toLowerCase();
        return !term || haystack.includes(term);
    }).slice(0, 20);
    const invoiceCustomerMatches = customers.filter((customer) => {
        const haystack = `${customer.name} ${customer.document ?? ''}`.toLowerCase();
        const term = invoiceCustomerQuery.trim().toLowerCase();
        return !term || haystack.includes(term);
    }).slice(0, 20);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = Number(discountTotal || 0);
    const total = Math.max(0, subtotal - discount);
    const usdPaidCrc = usdToCrc(usdPaid, effectiveExchangeRate);
    const paid = Number(cashPaid || 0) + Number(cardPaid || 0) + Number(creditPaid || 0) + usdPaidCrc;
    const change = Math.max(0, paid - total);
    const balance = Math.max(0, total - paid);
    const canSell = Boolean(openSession) && cart.length > 0;
    const selectedPaymentSummary = saleMode === 'cash'
        ? 'Contado'
        : saleMode === 'credit'
            ? 'Credito'
            : saleMode === 'layaway'
                ? 'Apartado'
                : 'Cotizacion';
    const showPaymentAmounts = paymentFlow === 'cash' || paymentFlow === 'mixed' || (paymentFlow === 'credit' && saleMode === 'credit');
    const paymentFlowLabel = paymentFlow === 'cash'
        ? 'Cobro contado'
        : paymentFlow === 'credit'
            ? 'Cobro credito'
            : 'Cobro mixto';
    const creditBalance = Math.max(0, total - Number(cashPaid || 0) - Number(cardPaid || 0) - Number(creditPaid || 0) - usdPaidCrc);
    const paymentIsMixed = paymentFlow === 'mixed';
    const paymentIsCredit = paymentFlow === 'credit';
    const posLocked = !openSession;
    const manualInvoiceOrder = pendingSales.filter((sale) => selectedInvoiceIds.includes(sale.id)).sort((a, b) => selectedInvoiceIds.indexOf(a.id) - selectedInvoiceIds.indexOf(b.id));
    const automaticInvoiceOrder = [...pendingSales].sort((a, b) => a.id - b.id);
    const invoicePreviewOrder = invoiceMode === 'manual' ? manualInvoiceOrder : automaticInvoiceOrder;
    const invoiceAmountNumber = Number(invoiceAmount || 0);
    const invoicePreviewAllocations = (() => {
        let remaining = invoiceAmountNumber;
        return invoicePreviewOrder.map((sale) => {
            const applied = Math.max(0, Math.min(sale.balance, remaining));
            remaining -= applied;
            return { ...sale, applied };
        }).filter((sale) => sale.applied > 0);
    })();
    const invoiceAppliedTotal = Object.values(invoiceAppliedAmounts).reduce((sum, value) => sum + Number(value || 0), 0);
    const manualAllocationPayload = selectedInvoiceIds
        .map((saleId) => ({
            sale_id: saleId,
            amount: Number(invoiceAppliedAmounts[saleId] || 0),
        }))
        .filter((row) => row.amount > 0);
    const formatPausedSaleTotal = (sale: PausedSale) => {
        const subtotalValue = sale.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discountValue = Number(sale.discountTotal || 0);
        return Math.max(0, subtotalValue - discountValue);
    };

    const filteredProducts = useMemo(() => {
        const term = query.trim().toLowerCase();
        const categoryMatches = (product: Product) => {
            if (selectedCategory === 'Todos') return true;

            return (product.category ?? '')
                .split('/')
                .map((category) => category.trim().toLowerCase())
                .includes(selectedCategory.toLowerCase());
        };

        const list = term
            ? catalogProducts.filter((product) =>
                categoryMatches(product) && (
                    product.name.toLowerCase().includes(term) ||
                    product.barcode.toLowerCase().includes(term) ||
                    (product.category ?? '').toLowerCase().includes(term)
                ),
            )
            : catalogProducts.filter(categoryMatches);

        return list.slice(0, 60);
    }, [catalogProducts, query, selectedCategory]);

    const categories = useMemo(() => {
        const names = catalogProducts
            .flatMap((product) => (product.category ?? '').split('/'))
            .map((category) => category.trim())
            .filter(Boolean);

        return ['Todos', ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)).slice(0, 18)];
    }, [catalogProducts]);

    const sessionBranch = openSession?.branch ?? 'Sucursal Norte';
    const sessionRegister = openSession?.cashRegister ?? 'Registro #402';
    const cashier = openSession?.user ?? 'Cajero';

    const addProduct = (product: Product) => {
        setCart((current) => {
            const existing = current.find((item) => item.product_id === product.id);
            if (existing) {
                return current.map((item) => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }

            return [
                ...current,
                {
                    product_id: product.id,
                    name: product.name,
                    barcode: product.barcode,
                    price: product.price * priceMultiplier,
                    quantity: 1,
                },
            ];
        });
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('pos.paused-sales', JSON.stringify(pausedSales));
    }, [pausedSales]);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    useEffect(() => {
        savePosSnapshot({
            products,
            customers,
            priceLists,
            promotions,
            exchangeRateUsdCrc,
            currency,
        });
    }, [products, customers, priceLists, promotions, exchangeRateUsdCrc, currency]);

    useEffect(() => {
        const sync = async () => {
            if (!navigator.onLine) return;
            await syncOfflineQueue();
        };

        void sync();
        window.addEventListener('online', sync);

        return () => window.removeEventListener('online', sync);
    }, []);

    useEffect(() => {
        if (!flash?.success) return;

        setStatusBanner(flash.success);
        if (flash.success.toLowerCase().includes('aprobacion')) {
            setApprovalModalOpen(true);
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate?.([120, 60, 120]);
            }
            if (typeof window !== 'undefined') {
                const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioCtx) {
                    approvalSound.current ??= new AudioCtx();
                    const context = approvalSound.current;
                    if (context.state === 'suspended') {
                        void context.resume();
                    }
                    const oscillator = context.createOscillator();
                    const gain = context.createGain();
                    oscillator.type = 'sine';
                    oscillator.frequency.value = 784;
                    gain.gain.value = 0.0001;
                    oscillator.connect(gain);
                    gain.connect(context.destination);
                    oscillator.start();
                    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
                    oscillator.stop(context.currentTime + 0.25);
                }
            }
        }
        const timer = window.setTimeout(() => setStatusBanner(null), 6000);
        return () => window.clearTimeout(timer);
    }, [flash?.success]);

    useEffect(() => {
        if (!approvalModalOpen) return;

        const timer = window.setTimeout(() => setApprovalModalOpen(false), 7000);
        return () => window.clearTimeout(timer);
    }, [approvalModalOpen]);

    useEffect(() => {
        const pendingSale = recentSales.find((sale) => sale.status === 'pending_approval') ?? null;

        if (pendingSale && approvalWatchSale !== pendingSale.number) {
            setApprovalWatchSale(pendingSale.number);
            setApprovalWatchState('pending_approval');
            setApprovalWatchResolved(null);
            setSelectedApprovalSale(pendingSale.number);
            setStatusBanner(`La venta ${pendingSale.number} esta esperando aprobacion.`);
        }

        if (approvalWatchSale && pendingSale === null && approvalWatchResolved === null) {
            const resolvedSale = recentSales.find((sale) => sale.number === approvalWatchSale);
            if (resolvedSale && resolvedSale.status !== 'pending_approval') {
                setApprovalWatchResolved(resolvedSale.status);
                setApprovalWatchState(resolvedSale.status === 'rejected' ? 'rejected' : 'approved');
                if (resolvedSale.status === 'rejected') {
                    setStatusBanner(`La venta ${resolvedSale.number} fue rechazada por el admin.`);
                } else {
                    setStatusBanner(`La venta ${resolvedSale.number} fue aprobada y ya puede finalizarse.`);
                }
                setApprovalModalOpen(true);
            }
        }
    }, [recentSales, approvalWatchSale, approvalWatchResolved]);

    const pendingApprovalSales = recentSales.filter((sale) => sale.status === 'pending_approval');
    const approvalBySaleId = approvalRequests.reduce<Record<number, (typeof approvalRequests)[number]>>((acc, request) => {
        if (request.sale_id !== null) acc[request.sale_id] = request;
        return acc;
    }, {});
    const activeApprovalSale = selectedApprovalSale
        ? recentSales.find((sale) => sale.number === selectedApprovalSale) ?? null
        : recentSales.find((sale) => sale.status === 'pending_approval') ?? null;
    const activeApprovalRequest = activeApprovalSale ? approvalBySaleId[activeApprovalSale.id] ?? null : null;
    const activeApprovalState = activeApprovalRequest?.status === 'approved'
        ? 'approved'
        : activeApprovalRequest?.status === 'rejected'
            ? 'rejected'
            : activeApprovalSale?.status === 'pending_approval'
                ? 'pending_approval'
                : null;
    const activeApprovalMessage = activeApprovalState === 'approved'
        ? `La venta ${activeApprovalSale?.number ?? ''} ya fue aprobada por el admin.`
        : activeApprovalState === 'rejected'
            ? `La venta ${activeApprovalSale?.number ?? ''} fue rechazada por el admin.`
            : `La venta ${activeApprovalSale?.number ?? ''} esta esperando aprobacion.`;

    useEffect(() => {
        if (!approvalWatchSale || approvalWatchResolved) return;

        const timer = window.setInterval(() => {
            router.reload({ only: ['recentSales', 'approvals'] });
        }, 10000);

        return () => window.clearInterval(timer);
    }, [approvalWatchSale, approvalWatchResolved]);

    const updateQuantity = (productId: number, quantity: number) => {
        setCart((current) => current
            .map((item) => item.product_id === productId ? { ...item, quantity } : item)
            .filter((item) => item.quantity > 0));
    };

    const submitSale = () => {
        setPaymentError('');

        if (!cart.length || !openSession) return;
        if (approvedSaleToFinalize) {
            router.post(route('pos.sale.finalize-approved', approvedSaleToFinalize), {}, {
                preserveScroll: true,
                onSuccess: () => {
                    setApprovedSaleToFinalize(null);
                    setCart([]);
                    setCustomerId('');
                    setDiscountTotal('0.00');
                    setPriceListId('');
                    setPromotionId('');
                    setCashPaid('');
                    setCardPaid('');
                    setCreditPaid('');
                    setUsdPaid('');
                    setNotes('');
                    setPaymentDialogOpen(false);
                    setSaleMode('cash');
                    setPaymentFlow('cash');
                    setStatusBanner('Venta autorizada finalizada correctamente.');
                },
                onError: () => setPaymentError('No se pudo finalizar la venta autorizada.'),
            });
            return;
        }
        if ((saleMode === 'credit' || paymentIsCredit || paymentIsMixed) && !selectedCustomer) {
            setPaymentError('Selecciona un cliente para vender a credito o mixto.');
            return;
        }

        const cashAmount = paymentIsCredit ? 0 : Number(cashPaid || 0);
        const cardAmount = paymentIsCredit ? 0 : Number(cardPaid || 0);
        const thirdPaymentAmount = Number(creditPaid || 0);
        const usdAmount = Number(usdPaid || 0);
        const usdAmountCrc = usdToCrc(usdAmount, exchangeRateUsdCrc);
        const paidToday = cashAmount + cardAmount + thirdPaymentAmount + usdAmountCrc;
        const effectiveSaleMode = paymentFlow === 'credit'
            ? 'credit'
            : paymentFlow === 'mixed' && paidToday < total
                ? 'credit'
                : saleMode;

        if (usdAmount > 0 && effectiveExchangeRate <= 0) {
            setPaymentError('Configura el tipo de cambio USD a CRC antes de recibir dolares.');
            return;
        }

        if (effectiveSaleMode === 'cash' && paidToday < total) {
            setPaymentError(`El pago recibido debe cubrir el total: faltan ${money(total - paidToday)}.`);
            return;
        }

        const salePayload = {
            items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity, unit_price: item.price })),
            customer_id: customerId || null,
            sale_mode: effectiveSaleMode,
            discount_total: discount,
            cash_paid: cashAmount,
            card_paid: cardAmount,
            credit_paid: thirdPaymentAmount,
            usd_paid: usdAmount,
            exchange_rate_usd_crc: usdAmount > 0 ? effectiveExchangeRate : null,
            notes,
            price_list_multiplier: priceMultiplier,
            promotion_id: promotionId || null,
        };

        const resetSaleForm = (message: string) => {
            setStatusBanner(message);
            setCart([]);
            setDiscountTotal('0.00');
            setCashPaid('');
            setCardPaid('');
            setCreditPaid('');
            setUsdPaid('');
            setNotes('');
            setPaymentDialogOpen(false);
            setPaymentFlow('cash');
            setPaymentError('');
        };

        if (!isOnline) {
            void enqueueOfflineItem('sale', salePayload);
            resetSaleForm('Venta guardada sin internet. Se sincronizara al volver la conexion.');
            return;
        }

        router.post(route('pos.sale.store'), salePayload, {
            preserveScroll: true,
            onSuccess: () => {
                resetSaleForm('Venta registrada correctamente.');
            },
            onError: (errors) => {
                setPaymentError(errors.payment || errors.customer_id || 'No se pudo registrar la venta. Revisa el cobro.');
            },
        });
    };

    const openCustomerDialog = () => {
        setCustomerDialogOpen(true);
        setTimeout(() => customerSearchRef.current?.focus(), 0);
    };

    const createCustomer = () => {
        router.post(route('customers.store'), {
            name: newCustomerName,
            document: newCustomerDocument || null,
            credit_limit: newCustomerLimit ? Number(newCustomerLimit) : 0,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewCustomerName('');
                setNewCustomerDocument('');
                setNewCustomerLimit('');
                setCustomerDialogOpen(false);
            },
        });
    };

    const pauseCurrentSale = () => {
        if (!cart.length) return;

        const id = `sale-${Date.now()}`;
        setPausedSales((current) => [
            {
                id,
                label: `${saleMode.toUpperCase()} - ${new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}`,
                cart,
                customerId,
                saleMode,
                discountTotal,
                priceListId,
                promotionId,
                cashPaid,
                cardPaid,
                creditPaid,
                usdPaid,
                notes,
            },
            ...current,
        ]);

        setActivePauseId(id);
        setCart([]);
        setCustomerId('');
        setDiscountTotal('0.00');
        setPriceListId('');
        setPromotionId('');
        setCashPaid('');
        setCardPaid('');
        setCreditPaid('');
        setUsdPaid('');
        setNotes('');
        setPaymentDialogOpen(false);
        setInvoiceDialogOpen(false);
        setSaleMode('cash');
        setPaymentFlow('cash');
    };

    const resumePausedSale = (id: string) => {
        const paused = pausedSales.find((sale) => sale.id === id);
        if (!paused) return;

        setCart(paused.cart);
        setCustomerId(paused.customerId);
        setSaleMode(paused.saleMode);
        setDiscountTotal(paused.discountTotal);
        setPriceListId(paused.priceListId);
        setPromotionId(paused.promotionId);
        setCashPaid(paused.cashPaid);
        setCardPaid(paused.cardPaid);
        setCreditPaid(paused.creditPaid);
        setUsdPaid(paused.usdPaid ?? '');
        setNotes(paused.notes);
        setActivePauseId(id);
        setPausedSales((current) => current.filter((sale) => sale.id !== id));
    };

    const clearPausedSales = () => {
        setPausedSales([]);
        setActivePauseId(null);
    };

    const loadApprovedSale = async (saleId: number) => {
        const response = await fetch(route('pos.sale.approval', saleId), {
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;

        const data = await response.json();
        const payload = data.payload ?? {};
        const items = Array.isArray(payload.items) ? payload.items : [];

        setCart(items.map((item: { product_id: number; quantity: number; unit_price?: number }) => {
            const product = catalogProducts.find((entry) => entry.id === item.product_id);
            return {
                product_id: item.product_id,
                name: product?.name ?? `Producto ${item.product_id}`,
                barcode: product?.barcode ?? '',
                price: Number(item.unit_price ?? product?.price ?? 0),
                quantity: Number(item.quantity ?? 1),
            };
        }));
        setCustomerId(data.sale?.customer_id ?? '');
        setSaleMode((payload.sale_mode ?? 'cash') as SaleMode);
        const subtotal = items.reduce((sum: number, item: { quantity: number; unit_price?: number }) => sum + Number(item.unit_price ?? 0) * Number(item.quantity ?? 0), 0);
        const approvedAmount = Number(data.approval?.approved_amount ?? subtotal);
        const saleMode = (payload.sale_mode ?? 'cash') as SaleMode;
        const discountValue = data.approval?.type === 'discount_override'
            ? Math.max(0, approvedAmount)
            : Number(payload.discount_total ?? 0);
        setDiscountTotal(discountValue.toFixed(2));
        setCashPaid(Number(payload.cash_paid ?? 0).toFixed(2));
        setCardPaid(Number(payload.card_paid ?? 0).toFixed(2));
        setCreditPaid(Number(payload.credit_paid ?? 0).toFixed(2));
        setUsdPaid(Number(payload.usd_paid ?? 0).toFixed(2));
        setNotes(payload.notes ?? '');
        setApprovedSaleToFinalize(data.sale?.id ?? saleId);
        setPaymentFlow(saleMode === 'credit' ? 'credit' : 'cash');
        setPaymentDialogOpen(true);
        setStatusBanner(`La venta ${data.sale?.number ?? saleId} ya puede finalizarse con el monto autorizado.`);
    };

    const removePausedSale = (id: string) => {
        setPausedSales((current) => current.filter((sale) => sale.id !== id));
        setActivePauseId((current) => (current === id ? null : current));
    };

    const persistPendingSalesSnapshot = (customerIdValue: number, sales: PendingSale[], customer: Customer | undefined) => {
        const currentSnapshot = readPosSnapshot<Record<string, unknown>>() ?? {};
        savePosSnapshot({
            ...currentSnapshot,
            pendingSalesByCustomer: {
                ...(currentSnapshot.pendingSalesByCustomer as Record<string, PendingSalesSnapshot> | undefined),
                [customerIdValue]: {
                    customerId: customerIdValue,
                    sales,
                    customer: {
                        id: customerIdValue,
                        name: customer?.name ?? 'Cliente',
                        document: customer?.document ?? null,
                        credit_balance: customer?.credit_balance ?? 0,
                    },
                    capturedAt: new Date().toISOString(),
                },
            },
        });
    };

    const loadPendingSales = async (customerIdValue: number) => {
        if (!isOnline) {
            const snapshotPending = readPosSnapshot<{ pendingSalesByCustomer?: Record<string, PendingSalesSnapshot> }>();
            setPendingSales(snapshotPending?.pendingSalesByCustomer?.[String(customerIdValue)]?.sales ?? []);
            return;
        }

        const response = await fetch(route('pos.credit.pending-sales', customerIdValue), {
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const data = await response.json();
        setPendingSales(data.sales ?? []);
        persistPendingSalesSnapshot(customerIdValue, data.sales ?? [], data.customer);
    };

    useEffect(() => {
        if (!invoiceDialogOpen || !customerId) {
            setPendingSales([]);
            return;
        }

        void loadPendingSales(customerId);
    }, [invoiceDialogOpen, customerId, isOnline]);

    useEffect(() => {
        if (!customerId || !pendingSales.length) return;
        const selected = catalogCustomers.find((customer) => customer.id === customerId);
        persistPendingSalesSnapshot(customerId, pendingSales, selected);
    }, [customerId, pendingSales, catalogCustomers]);

    useEffect(() => {
        if (!flash?.credit_payment_ticket) return;
        if (!autoPrintReceipts) return;
        if (printTicketWindow.current && !printTicketWindow.current.closed) {
            printTicketWindow.current.location.href = route('pos.credit-payments.ticket', flash.credit_payment_ticket);
            printTicketWindow.current = null;
            return;
        }

        window.open(route('pos.credit-payments.ticket', flash.credit_payment_ticket), '_blank', 'width=420,height=800');
    }, [flash?.credit_payment_ticket]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (posLocked) return;

            if (event.key === 'F1') {
                event.preventDefault();
                searchRef.current?.focus();
            }

            if (event.key === 'F5') {
                event.preventDefault();
                setPaymentDialogOpen(true);
            }

            if (event.key === 'F6') {
                event.preventDefault();
                openCustomerDialog();
            }

            if (event.key === 'Escape') {
                setCart([]);
                setCustomerDialogOpen(false);
                setPaymentDialogOpen(false);
                setPaymentFlow('cash');
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [cart, total, saleMode, customerId, discountTotal, cashPaid, cardPaid, creditPaid, usdPaid, notes, priceMultiplier, promotionId, openSession, posLocked]);

    return (
        <>
            <Head title="CorpERP - Terminal de Punto de Venta" />
            {pendingApprovals > 0 && permissions.accessReports && (
                <div className="fixed inset-x-0 top-0 z-[75] flex justify-center px-4 pt-4">
                    <div className="flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-amber-900">Aprobaciones pendientes</p>
                            <p className="text-sm text-amber-800">{pendingApprovals} venta(s) esperando decision.</p>
                        </div>
                        <Link
                            href={route('admin.approvals.index')}
                            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                        >
                            Ver
                        </Link>
                    </div>
                </div>
            )}
            {statusBanner && (
                <div className="fixed inset-x-0 top-0 z-[75] flex justify-center px-4 pt-4">
                    <div className={`w-full max-w-3xl rounded-3xl border px-5 py-4 shadow-2xl ${
                        activeApprovalState === 'approved'
                            ? 'border-emerald-200 bg-emerald-50'
                            : activeApprovalState === 'rejected'
                                ? 'border-rose-200 bg-rose-50'
                                : 'border-amber-200 bg-amber-50'
                    }`}>
                        <div className="flex items-start gap-3">
                            <span className={`material-symbols-outlined mt-0.5 text-[24px] ${
                                activeApprovalState === 'approved'
                                    ? 'text-emerald-700'
                                    : activeApprovalState === 'rejected'
                                        ? 'text-rose-700'
                                        : 'text-amber-700'
                            }`}>
                                {activeApprovalState === 'approved' ? 'task_alt' : activeApprovalState === 'rejected' ? 'cancel' : 'hourglass_top'}
                            </span>
                            <div className="min-w-0">
                                <p className={`text-base font-semibold ${
                                    activeApprovalState === 'approved'
                                        ? 'text-emerald-900'
                                        : activeApprovalState === 'rejected'
                                            ? 'text-rose-900'
                                            : 'text-amber-900'
                                }`}>
                                    {activeApprovalState === 'approved'
                                        ? 'Venta aprobada, continuar'
                                        : activeApprovalState === 'rejected'
                                            ? 'Venta rechazada, rehacer'
                                            : 'Venta pendiente de aprobacion'}
                                </p>
                                <p className={`text-sm ${
                                    activeApprovalState === 'approved'
                                        ? 'text-emerald-800'
                                        : activeApprovalState === 'rejected'
                                            ? 'text-rose-800'
                                            : 'text-amber-800'
                                }`}>{activeApprovalMessage}</p>
                                {activeApprovalSale && (
                                    <div className="mt-3 rounded-2xl border border-black/5 bg-white/70 px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                                            <span className="font-semibold text-on-surface">Venta #{activeApprovalSale.number}</span>
                                            <span className="text-on-surface-variant">Total {money(activeApprovalSale.total)}</span>
                                            <span className="text-on-surface-variant">Estado {activeApprovalSale.status}</span>
                                            <button
                                                type="button"
                                                onClick={() => router.reload({ only: ['recentSales', 'approvals'] })}
                                                className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container-low"
                                            >
                                                Refrescar esta venta
                                            </button>
                                            {activeApprovalState === 'approved' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (approvalWatchSale) {
                                                            const approvedSale = recentSales.find((sale) => sale.number === approvalWatchSale);
                                                            if (approvedSale) {
                                                                void loadApprovedSale(approvedSale.id);
                                                            }
                                                        }
                                                    }}
                                                    className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                                >
                                                    Finalizar venta
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        router.reload({ only: ['recentSales', 'approvals'] });
                                        setApprovalModalOpen(true);
                                    }}
                                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                        activeApprovalState === 'approved'
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : activeApprovalState === 'rejected'
                                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                                : 'bg-amber-600 text-white hover:bg-amber-700'
                                    }`}
                                >
                                    {activeApprovalState === 'approved' ? 'Ver aprobado' : activeApprovalState === 'rejected' ? 'Ver rechazo' : 'Refrescar aprobación'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStatusBanner(null);
                                        setApprovalWatchState(null);
                                    }}
                                    className={`rounded-full p-1 ${
                                        activeApprovalState === 'approved'
                                            ? 'text-emerald-900 hover:bg-emerald-100'
                                            : activeApprovalState === 'rejected'
                                                ? 'text-rose-900 hover:bg-rose-100'
                                                : 'text-amber-900 hover:bg-amber-100'
                                    }`}
                                    aria-label="Cerrar aviso"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {approvalModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <div className="grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                                <span className="material-symbols-outlined animate-pulse">notifications_active</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-label-md text-amber-700">Requiere aprobacion</p>
                                <h3 className="text-headline-sm text-on-surface">La venta quedo en espera</h3>
                                <p className="mt-2 text-body-sm text-on-surface-variant">
                                    El gerente debe aprobarla antes de que se complete. Puedes seguir trabajando con otra venta.
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                className="flex-1 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-body-sm font-semibold text-on-surface hover:bg-surface-container-low"
                                onClick={() => router.reload({ only: ['recentSales', 'approvals'] })}
                            >
                                Refrescar estado
                            </button>
                            <button
                                type="button"
                                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary"
                                onClick={() => {
                                    if (activeApprovalState === 'approved' && approvalWatchSale) {
                                        const approvedSale = recentSales.find((sale) => sale.number === approvalWatchSale);
                                        if (approvedSale) {
                                            void loadApprovedSale(approvedSale.id);
                                        }
                                    } else {
                                        router.reload({ only: ['recentSales', 'approvals'] });
                                    }
                                    setApprovalModalOpen(false);
                                }}
                            >
                                {activeApprovalState === 'approved' ? 'Finalizar venta' : 'Entendido'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="h-screen overflow-hidden bg-background text-on-background font-sans">
                <AppSidebar />

                <main className="ml-[260px] flex h-full flex-col overflow-hidden">
                    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-xl">
                        <div className="flex w-full items-center gap-xl">
                            <div className="relative w-full max-w-md rounded focus-within:ring-2 focus-within:ring-secondary/20">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                                <input
                                    ref={searchRef}
                                    className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-10 pr-12 font-body-md text-body-md focus:border-secondary focus:outline-none"
                                    placeholder="Buscar producto o codigo (F1)..."
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-outline-variant px-1 font-mono-md text-[10px] text-outline">F1</span>
                            </div>

                            <nav className="ml-auto hidden items-center gap-lg md:flex">
                                <Link className="border-b-2 border-secondary py-5 font-label-md text-secondary" href={route('dashboard')}>Cajero POS</Link>
                                {permissions.accessProducts && (
                                    <Link className="py-5 font-label-md text-on-surface-variant transition-all hover:text-primary" href={route('admin.inventory.products')}>Inventario</Link>
                                )}
                                {permissions.accessReports && (
                                    <Link className="py-5 font-label-md text-on-surface-variant transition-all hover:text-primary" href={route('admin.reports.index')}>Ventas Diarias</Link>
                                )}
                            </nav>
                        </div>

                        <div className="ml-xl flex items-center gap-md">
                            <div className="mr-4 hidden min-w-max flex-col items-end lg:flex">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface">Cajero: {cashier}</span>
                                <span className="font-body-sm text-[11px] text-on-surface-variant">{sessionRegister} - {sessionBranch}</span>
                            </div>
                            <button className="relative rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container">
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-surface bg-error"></span>
                            </button>
                            <button className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container">
                                <span className="material-symbols-outlined">help</span>
                            </button>
                            <div className="mx-2 h-8 w-px bg-outline-variant"></div>
                            <div className="flex cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-container">
                                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary-fixed text-on-secondary-fixed">
                                    <span className="material-symbols-outlined text-[20px]">person</span>
                                </div>
                                <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
                            </div>
                        </div>
                    </header>

                    {pendingApprovalSales.length > 0 && (
                        <section className="border-b border-outline-variant bg-surface-container/60 px-xl py-4">
                            <div className="mb-3 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-on-surface">Ventas en espera</p>
                                    <p className="text-xs text-on-surface-variant">
                                        Toca una venta para verla arriba y refrescar su estado.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => router.reload({ only: ['recentSales', 'approvals'] })}
                                    className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low"
                                >
                                    Refrescar cola
                                </button>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-1">
                                {pendingApprovalSales.map((sale) => {
                                    const isActive = sale.number === activeApprovalSale?.number;
                                    const activeStateLabel = activeApprovalState === 'approved'
                                        ? 'Aprobada'
                                        : activeApprovalState === 'rejected'
                                            ? 'Rechazada'
                                            : 'Pendiente';

                                    return (
                                        <button
                                            key={sale.number}
                                            type="button"
                                            onClick={() => {
                                                setSelectedApprovalSale(sale.number);
                                                setApprovalWatchSale(sale.number);
                                                setApprovalWatchState('pending_approval');
                                                setApprovalWatchResolved(null);
                                                setApprovalModalOpen(true);
                                                setStatusBanner(`La venta ${sale.number} esta esperando aprobacion.`);
                                            }}
                                            className={`min-w-[230px] rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                                                isActive
                                                    ? activeApprovalState === 'approved'
                                                        ? 'border-emerald-300 bg-emerald-50'
                                                        : activeApprovalState === 'rejected'
                                                            ? 'border-rose-300 bg-rose-50'
                                                            : 'border-amber-300 bg-amber-50'
                                                    : 'border-outline-variant bg-surface hover:bg-surface-container-low'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-on-surface">Venta #{sale.number}</p>
                                                    <p className="text-xs text-on-surface-variant">
                                                        {sale.created_at ? new Date(sale.created_at).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha'}
                                                    </p>
                                                </div>
                                                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-amber-700' : 'text-outline'}`}>hourglass_top</span>
                                            </div>
                                            <div className="mt-3 flex items-end justify-between gap-3">
                                                <div>
                                                    <p className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">Total</p>
                                                    <p className="text-lg font-black text-on-surface">{money(sale.total)}</p>
                                                </div>
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                                    isActive
                                                        ? activeApprovalState === 'approved'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : activeApprovalState === 'rejected'
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {isActive ? activeStateLabel : 'Pendiente'}
                                                </span>
                                            </div>
                                            <div className="mt-3 rounded-xl border border-dashed border-amber-200 bg-white/70 px-3 py-2 text-xs text-on-surface-variant">
                                                {isActive
                                                    ? activeApprovalState === 'approved'
                                                        ? 'Lista para finalizar con el monto autorizado'
                                                        : activeApprovalState === 'rejected'
                                                            ? 'Debe rehacerse antes de continuar'
                                                            : 'Seleccionada para seguimiento'
                                                    : 'Ver estado y refrescar'}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <div className="relative flex min-h-0 flex-1 overflow-hidden">
                        {posLocked ? (
                            <div className="flex flex-1 items-center justify-center bg-surface-container-low p-6">
                                <div className="w-full max-w-2xl rounded-3xl border border-outline-variant bg-white p-8 shadow-2xl">
                                    <div className="flex items-start gap-4">
                                        <span className="material-symbols-outlined rounded-2xl bg-secondary/10 p-3 text-4xl text-secondary">point_of_sale</span>
                                        <div className="min-w-0">
                                            <p className="text-label-md uppercase tracking-[0.2em] text-on-surface-variant">Caja cerrada</p>
                                            <h2 className="mt-1 font-headline-lg text-headline-md font-bold text-on-surface">No puedes operar el POS sin abrir la caja</h2>
                                            <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">Abre la caja con el fondo inicial antes de vender, cobrar, pausar ventas o registrar abonos desde el POS.</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                                        <div className="rounded-2xl bg-surface-container-low p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Estado</p>
                                            <p className="mt-2 text-lg font-bold text-on-surface">Bloqueado</p>
                                        </div>
                                        <div className="rounded-2xl bg-surface-container-low p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Accion permitida</p>
                                            <p className="mt-2 text-lg font-bold text-on-surface">Abrir caja</p>
                                        </div>
                                        <div className="rounded-2xl bg-surface-container-low p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Efectivo inicial</p>
                                            <p className="mt-2 text-lg font-bold text-on-surface">Definir al abrir</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap gap-3">
                                        <Link className="rounded-lg bg-secondary px-4 py-3 font-medium text-on-secondary shadow-md" href={route('admin.cash.index')}>
                                            Abrir caja ahora
                                        </Link>
                                        <button type="button" disabled className="rounded-lg border border-outline-variant bg-white px-4 py-3 font-medium text-on-surface-variant opacity-60">
                                            Cobrar y vender desactivado
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                        <section className="flex flex-[7] flex-col overflow-hidden border-r border-outline-variant bg-surface-container-low p-gutter">
                            <div className="mb-gutter flex gap-2 overflow-x-auto no-scrollbar">
                                {categories.map((category) => (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => setSelectedCategory(category)}
                                        className={`whitespace-nowrap rounded px-4 py-1.5 font-label-md text-[11px] uppercase tracking-wider ${selectedCategory === category ? 'bg-secondary text-on-secondary' : 'border border-outline-variant bg-white text-on-surface transition-colors hover:bg-surface-container'}`}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>

                            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 overflow-y-auto pr-1 no-scrollbar">
                                {filteredProducts.map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        onClick={() => addProduct(product)}
                                        className={`${productTone(product.category)} flex h-[100px] cursor-pointer flex-col justify-between rounded border p-3 text-left transition-all hover:shadow-md active:scale-95`}
                                    >
                                        <span className="font-mono-md text-[10px] font-bold uppercase">{product.barcode}</span>
                                        <h3 className="line-clamp-2 font-body-md text-body-sm font-semibold leading-tight text-on-surface">{product.name}</h3>
                                        <div className="flex items-end justify-between">
                                        <span className="font-mono-md text-body-md font-bold text-secondary">{money(product.price)}</span>
                                            <span className="text-[10px] text-outline">Stock {product.stock}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="flex flex-[5] flex-col overflow-hidden border-l border-outline-variant bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-outline-variant bg-surface p-6">
                                <h2 className="font-headline-md text-headline-md font-bold">Carrito Actual</h2>
                                <span className="rounded bg-secondary px-3 py-1 font-label-md text-label-md text-on-secondary">{cart.length} ITEMS</span>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto">
                                <table className="w-full border-collapse text-left">
                                    <thead className="sticky top-0 z-10 bg-surface-container-low">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-label-md text-[10px] uppercase tracking-widest text-outline">Producto</th>
                                            <th className="px-4 py-2 text-center font-label-md text-[10px] uppercase tracking-widest text-outline">Cant.</th>
                                            <th className="px-4 py-2 text-right font-label-md text-[10px] uppercase tracking-widest text-outline">Total</th>
                                            <th className="px-4 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-outline-variant">
                                        {cart.length ? cart.map((item) => (
                                            <tr key={item.product_id} className="group transition-colors hover:bg-surface-container-lowest">
                                                <td className="px-4 py-3">
                                                    <p className="font-body-md font-bold leading-tight text-on-surface">{item.name}</p>
                                                    <p className="font-mono-md text-[11px] text-on-surface-variant">{money(item.price)} c/u</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button className="flex h-7 w-7 items-center justify-center rounded border border-outline-variant transition-colors hover:bg-surface-container-high" onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                                                            <span className="material-symbols-outlined text-[16px]">remove</span>
                                                        </button>
                                                        <input className="h-7 w-10 rounded border border-outline-variant p-0 text-center font-mono-md text-body-sm focus:ring-1 focus:ring-secondary" value={item.quantity} onChange={(event) => updateQuantity(item.product_id, Number(event.target.value))} />
                                                        <button className="flex h-7 w-7 items-center justify-center rounded border border-outline-variant transition-colors hover:bg-surface-container-high" onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                                                            <span className="material-symbols-outlined text-[16px]">add</span>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-mono-md text-body-md font-bold">{money(item.price * item.quantity)}</span>
                                                </td>
                                                <td className="w-10 px-4 py-3 text-right">
                                                    <button className="text-outline opacity-0 transition-opacity hover:text-error group-hover:opacity-100" onClick={() => setCart((current) => current.filter((row) => row.product_id !== item.product_id))}>
                                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center font-body-md text-on-surface-variant">Agrega productos desde el panel izquierdo.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-4 border-t border-outline-variant bg-surface-container-low p-6">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-white p-3 text-sm">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="material-symbols-outlined rounded-full bg-secondary/10 p-2 text-secondary">point_of_sale</span>
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-on-surface">{openSession ? `${openSession.cashRegister} - ${openSession.branch}` : 'Caja cerrada'}</div>
                                            <div className="text-on-surface-variant">Apertura {openSession ? money(openSession.openingFloat) : money(0)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold text-on-surface-variant">
                                            Cliente: {selectedCustomer ? selectedCustomer.name : 'Sin cliente'}
                                        </span>
                                        <button type="button" onClick={openCustomerDialog} className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface">
                                            Buscar cliente
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <select className="rounded border border-outline-variant bg-white px-3 py-2 font-body-sm text-body-sm" value={saleMode} onChange={(event) => setSaleMode(event.target.value as SaleMode)}>
                                        <option value="cash">Contado</option>
                                        <option value="credit">Credito</option>
                                        <option value="layaway">Apartado</option>
                                        <option value="quote">Cotizacion</option>
                                    </select>
                                    <button type="button" onClick={() => setPaymentDialogOpen(true)} className="rounded border border-outline-variant bg-white px-3 py-2 text-left font-body-sm text-body-sm">
                                        Metodo de pago: {selectedPaymentSummary}
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={openCustomerDialog} className="group flex items-center gap-2 rounded border border-outline-variant bg-white px-3 py-2 transition-colors hover:bg-surface-container">
                                        <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary">person_add</span>
                                        <span className="font-label-md text-[10px] uppercase">Cliente (F6)</span>
                                    </button>
                                    <button type="button" onClick={() => setInvoiceDialogOpen(true)} className="group flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-on-secondary shadow-md transition-colors hover:bg-secondary/90">
                                        <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                                        <span className="font-label-md text-[10px] uppercase tracking-wider">Abono a factura</span>
                                    </button>
                                    <button type="button" onClick={pauseCurrentSale} disabled={!cart.length} className="group flex items-center gap-2 rounded border border-outline-variant bg-white px-3 py-2 transition-colors hover:bg-surface-container disabled:opacity-50">
                                        <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary">pause_circle</span>
                                        <span className="font-label-md text-[10px] uppercase">Pausar venta</span>
                                    </button>
                                    <button type="button" className="group flex items-center gap-2 rounded border border-outline-variant bg-white px-3 py-2 transition-colors hover:bg-surface-container">
                                        <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary">delete_sweep</span>
                                        <span className="font-label-md text-[10px] uppercase">Limpiar</span>
                                    </button>
                                </div>

                                    {pausedSales.length > 0 && (
                                    <div className="rounded-xl border border-outline-variant bg-white p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="text-sm font-semibold text-on-surface">Ventas pausadas</div>
                                            <button type="button" onClick={clearPausedSales} className="text-xs font-semibold text-error">
                                                Vaciar pausadas
                                            </button>
                                        </div>
                                        <div className="max-h-44 overflow-y-auto pr-1">
                                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                {pausedSales.map((sale) => {
                                                    const customer = sale.customerId ? customers.find((item) => item.id === sale.customerId) : null;
                                                    const totalValue = formatPausedSaleTotal(sale);

                                                    return (
                                                        <div
                                                            key={sale.id}
                                                            className={`rounded-2xl border bg-surface-container-low p-3 shadow-sm transition-colors ${activePauseId === sale.id ? 'border-secondary bg-secondary/10' : 'border-outline-variant'}`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold text-on-surface">{customer?.name ?? 'Sin cliente'}</div>
                                                                    <div className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">{sale.label}</div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removePausedSale(sale.id)}
                                                                    className="rounded-full p-1 text-outline transition-colors hover:bg-surface-container hover:text-error"
                                                                    aria-label="Eliminar pausa"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                </button>
                                                            </div>

                                                            <div className="mt-3 text-2xl font-black tracking-tight text-on-surface">
                                                                {money(totalValue)}
                                                            </div>

                                                            <div className="mt-1 text-xs text-on-surface-variant">
                                                                {sale.cart.length} item(s) Â· {sale.saleMode === 'credit' ? 'CrÃ©dito' : sale.saleMode === 'layaway' ? 'Apartado' : sale.saleMode === 'quote' ? 'CotizaciÃ³n' : 'Contado'}
                                                            </div>

                                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => resumePausedSale(sale.id)}
                                                                    className="rounded-full bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wider text-on-secondary"
                                                                >
                                                                    Reanudar
                                                                </button>
                                                                <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
                                                                    {activePauseId === sale.id ? 'Activa' : 'Lista'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1 rounded-lg bg-surface-container-lowest p-3">
                                    <div className="flex items-center justify-between text-sm text-on-surface-variant"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                                    <div className="flex items-center justify-between text-sm text-on-surface-variant"><span>Descuento</span><span>-{money(discount)}</span></div>
                                    <div className="flex items-center justify-between text-sm text-on-surface-variant"><span>Total</span><span className="font-semibold text-on-surface">{money(total)}</span></div>
                                </div>

                                <button className="flex w-full flex-col items-center justify-center rounded-lg bg-secondary py-5 text-on-secondary shadow-lg transition-all hover:bg-secondary/90 active:scale-[0.99] disabled:opacity-50" disabled={processing || !canSell || (saleMode === 'credit' && !selectedCustomer) || !openSession} onClick={() => {
                                    setPaymentError('');
                                    setPaymentDialogOpen(true);
                                }}>
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                                        <span className="font-headline-lg font-bold">Cobrar</span>
                                    </div>
                                    <span className="mt-1 font-mono-md text-[12px] font-bold opacity-80">PRESIONE F5 PARA COBRAR</span>
                                </button>
                            </div>
                        </section>
                            </>
                        )}
                    </div>
                </main>

                <div className="fixed bottom-4 left-gutter z-50 flex gap-4 rounded bg-inverse-surface/90 px-4 py-2 text-inverse-on-surface shadow-xl backdrop-blur">
                    <Hotkey keyName="F1" label="Buscar" />
                    <Hotkey keyName="F2" label="Descuento" />
                    <Hotkey keyName="F6" label="Cliente" />
                    <Hotkey keyName="F5" label="Pagar" />
                    <Hotkey keyName="ESC" label="Cerrar" />
                </div>

                {customerDialogOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
                        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-headline-lg text-headline-md font-bold">Buscar o registrar cliente</h3>
                                    <p className="font-body-md text-body-sm text-on-surface-variant">Escanea el QR o escribe la cedula. Si no existe, lo puedes crear aqui.</p>
                                </div>
                                <button type="button" className="rounded-full p-2 hover:bg-surface-container" onClick={() => setCustomerDialogOpen(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div className="space-y-3">
                                    <input
                                        ref={customerSearchRef}
                                        className="w-full rounded border border-outline-variant px-3 py-2"
                                        placeholder="Escanear QR o escribir cedula"
                                        value={customerQuery}
                                        onChange={(event) => setCustomerQuery(event.target.value)}
                                    />
                                    <div className="max-h-64 overflow-y-auto rounded border border-outline-variant">
                                        {matchedCustomers.length ? matchedCustomers.map((customer) => (
                                            <button
                                                key={customer.id}
                                                type="button"
                                                className={`flex w-full items-center justify-between border-b border-outline-variant px-3 py-2 text-left last:border-b-0 ${customerId === customer.id ? 'bg-secondary/10' : 'hover:bg-surface-container'}`}
                                                onClick={() => {
                                                    setCustomerId(customer.id);
                                                    setCustomerDialogOpen(false);
                                                }}
                                            >
                                                <span>
                                                    <div className="font-semibold">{customer.name}</div>
                                                    <div className="text-xs text-on-surface-variant">{customer.document || 'Sin cedula'}</div>
                                                </span>
                                            <span className="text-xs text-on-surface-variant">Credito {money(customer.credit_balance)}</span>
                                            </button>
                                        )) : (
                                            <div className="p-4 text-sm text-on-surface-variant">No se encontro el cliente.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
                                    <h4 className="font-semibold">Nuevo cliente</h4>
                                    <input className="w-full rounded border border-outline-variant px-3 py-2" placeholder="Nombre completo" value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} />
                                    <input className="w-full rounded border border-outline-variant px-3 py-2" placeholder="Cedula / documento" value={newCustomerDocument} onChange={(event) => setNewCustomerDocument(event.target.value)} />
                                    <input className="w-full rounded border border-outline-variant px-3 py-2" placeholder="Limite de credito" value={newCustomerLimit} onChange={(event) => setNewCustomerLimit(event.target.value)} />
                                    <button type="button" className="w-full rounded-lg bg-secondary px-4 py-2 font-medium text-on-secondary" onClick={createCustomer} disabled={!newCustomerName.trim()}>
                                        Guardar cliente
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {paymentDialogOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
                        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-headline-lg text-headline-md font-bold">Cobro</h3>
                                    <p className="font-body-md text-body-sm text-on-surface-variant">Elige el flujo de cobro para esta venta.</p>
                                </div>
                                <button type="button" className="rounded-full p-2 hover:bg-surface-container" onClick={() => setPaymentDialogOpen(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <PaymentCard
                                        active={paymentFlow === 'cash'}
                                        title="Contado"
                                        description="Todo se paga hoy."
                                        icon="payments"
                                        onClick={() => {
                                            setPaymentFlow('cash');
                                            setPaymentCustomerQuery('');
                                            setPaymentError('');
                                            setCashPaid('');
                                            setCardPaid('');
                                            setCreditPaid('');
                                            setUsdPaid('');
                                        }}
                                    />
                                    <PaymentCard
                                        active={paymentFlow === 'credit'}
                                        title="Credito"
                                        description="Todo queda pendiente."
                                        icon="receipt_long"
                                        onClick={() => {
                                            setPaymentFlow('credit');
                                            setPaymentCustomerQuery('');
                                            setPaymentError('');
                                            setCashPaid('');
                                            setCardPaid('');
                                            setCreditPaid('');
                                            setUsdPaid('');
                                        }}
                                    />
                                    <PaymentCard
                                        active={paymentFlow === 'mixed'}
                                        title="Mixto"
                                        description="Parte hoy y parte a credito."
                                        icon="split_scene"
                                        onClick={() => {
                                            setPaymentFlow('mixed');
                                            setPaymentCustomerQuery('');
                                            setPaymentError('');
                                        }}
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                                            {paymentFlow === 'cash' && (
                                                <>
                                                    <div className="mb-3 rounded-lg bg-white p-3 text-sm text-on-surface-variant">
                                                        Paga hoy como prefieras.
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <AmountField label="Efectivo" value={cashPaid} onChange={setCashPaid} />
                                                        <AmountField label="Tarjeta" value={cardPaid} onChange={setCardPaid} />
                                                        <AmountField label="SINPE" value={creditPaid} onChange={setCreditPaid} />
                                                        <AmountField label="Dolares USD" value={usdPaid} onChange={setUsdPaid} />
                                                        <AmountField label="Descuento" value={discountTotal} onChange={setDiscountTotal} />
                                                    </div>
                                                </>
                                            )}

                                            {paymentFlow === 'credit' && (
                                                <>
                                                    <div className="mb-3 rounded-lg bg-white p-3 text-sm text-on-surface-variant">
                                                        Esta venta queda a credito. Elige un cliente y, si quieres, deja un abono.
                                                    </div>
                                                    <div className="rounded-xl bg-white p-3">
                                                        <label className="mb-2 block text-sm font-semibold text-on-surface">Buscar cliente</label>
                                                        <input
                                                            ref={customerSearchRef}
                                                            className="w-full rounded border border-outline-variant px-3 py-2"
                                                            placeholder="Escribe cÃ©dula o nombre"
                                                            value={paymentCustomerQuery}
                                                            onChange={(event) => setPaymentCustomerQuery(event.target.value)}
                                                        />

                                                        <div className="mt-3 max-h-52 overflow-y-auto rounded border border-outline-variant">
                                                            {paymentCustomerMatches.length ? paymentCustomerMatches.map((customer) => (
                                                                <button
                                                                    key={customer.id}
                                                                    type="button"
                                                                    className={`flex w-full items-center justify-between border-b border-outline-variant px-3 py-2 text-left last:border-b-0 ${customerId === customer.id ? 'bg-secondary/10' : 'hover:bg-surface-container'}`}
                                                                    onClick={() => {
                                                                        setCustomerId(customer.id);
                                                                        setPaymentCustomerQuery(customer.name);
                                                                    }}
                                                                >
                                                                    <span>
                                                                        <div className="font-semibold">{customer.name}</div>
                                                                        <div className="text-xs text-on-surface-variant">{customer.document || 'Sin cedula'}</div>
                                                                    </span>
                                                                    <span className="text-xs text-on-surface-variant">Credito {money(customer.credit_balance)}</span>
                                                                </button>
                                                            )) : (
                                                                <div className="p-4 text-sm text-on-surface-variant">No se encontro el cliente.</div>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <button type="button" onClick={openCustomerDialog} className="rounded border border-outline-variant bg-white px-3 py-2 text-sm font-semibold">
                                                                Buscar o crear
                                                            </button>
                                                            <button type="button" onClick={() => setCustomerDialogOpen(true)} className="rounded border border-outline-variant bg-white px-3 py-2 text-sm font-semibold">
                                                                Nuevo cliente
                                                            </button>
                                                        </div>

                                                        {selectedCustomer && (
                                                            <div className="mt-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface-variant">
                                                                Seleccionado: <span className="font-semibold text-on-surface">{selectedCustomer.name}</span>
                                                            </div>
                                                        )}

                                                        {!selectedCustomer && (
                                                            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                                                Este flujo necesita un cliente registrado.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 space-y-3">
                                                        <AmountField label="Abono inicial CRC" value={creditPaid} onChange={setCreditPaid} />
                                                        <AmountField label="Abono USD" value={usdPaid} onChange={setUsdPaid} />
                                                        <AmountField label="Descuento" value={discountTotal} onChange={setDiscountTotal} />
                                                    </div>
                                                </>
                                            )}

                                            {paymentFlow === 'mixed' && (
                                                <>
                                                    <div className="mb-3 rounded-lg bg-white p-3 text-sm text-on-surface-variant">
                                                        Divide esta venta entre hoy y credito.
                                                    </div>
                                                    <div className="rounded-xl bg-white p-3">
                                                        <label className="mb-2 block text-sm font-semibold text-on-surface">Buscar cliente</label>
                                                        <input
                                                            ref={customerSearchRef}
                                                            className="w-full rounded border border-outline-variant px-3 py-2"
                                                            placeholder="Escribe cÃ©dula o nombre"
                                                            value={paymentCustomerQuery}
                                                            onChange={(event) => setPaymentCustomerQuery(event.target.value)}
                                                        />

                                                        <div className="mt-3 max-h-52 overflow-y-auto rounded border border-outline-variant">
                                                            {paymentCustomerMatches.length ? paymentCustomerMatches.map((customer) => (
                                                                <button
                                                                    key={customer.id}
                                                                    type="button"
                                                                    className={`flex w-full items-center justify-between border-b border-outline-variant px-3 py-2 text-left last:border-b-0 ${customerId === customer.id ? 'bg-secondary/10' : 'hover:bg-surface-container'}`}
                                                                    onClick={() => {
                                                                        setCustomerId(customer.id);
                                                                        setPaymentCustomerQuery(customer.name);
                                                                    }}
                                                                >
                                                                    <span>
                                                                        <div className="font-semibold">{customer.name}</div>
                                                                        <div className="text-xs text-on-surface-variant">{customer.document || 'Sin cedula'}</div>
                                                                    </span>
                                                                    <span className="text-xs text-on-surface-variant">Credito {money(customer.credit_balance)}</span>
                                                                </button>
                                                            )) : (
                                                                <div className="p-4 text-sm text-on-surface-variant">No se encontro el cliente.</div>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <button type="button" onClick={openCustomerDialog} className="rounded border border-outline-variant bg-white px-3 py-2 text-sm font-semibold">
                                                                Buscar o crear
                                                            </button>
                                                            <button type="button" onClick={() => setCustomerDialogOpen(true)} className="rounded border border-outline-variant bg-white px-3 py-2 text-sm font-semibold">
                                                                Nuevo cliente
                                                            </button>
                                                        </div>

                                                        {selectedCustomer && (
                                                            <div className="mt-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface-variant">
                                                                Seleccionado: <span className="font-semibold text-on-surface">{selectedCustomer.name}</span>
                                                            </div>
                                                        )}

                                                        {!selectedCustomer && (
                                                            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                                                Este flujo necesita un cliente registrado.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 space-y-3">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <AmountField label="Efectivo" value={cashPaid} onChange={setCashPaid} />
                                                            <AmountField label="Tarjeta" value={cardPaid} onChange={setCardPaid} />
                                                            <AmountField label="SINPE" value={creditPaid} onChange={setCreditPaid} />
                                                            <AmountField label="Dolares USD" value={usdPaid} onChange={setUsdPaid} />
                                                            <AmountField label="Descuento" value={discountTotal} onChange={setDiscountTotal} />
                                                        </div>
                                                        <div className="rounded-lg border border-outline-variant bg-white p-3 text-sm text-on-surface-variant">
                                                            Parte a credito: {money(creditBalance)}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3 rounded-2xl bg-surface-container-low p-4">
                                        <div className="rounded-lg bg-white p-3">
                                            <div className="flex items-center justify-between text-sm"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span>Descuento</span><span>-{money(discount)}</span></div>
                                            <div className="flex items-center justify-between text-sm"><span>Total</span><span>{money(total)}</span></div>
                                            {Number(usdPaid || 0) > 0 && (
                                                <div className="mt-2 rounded border border-outline-variant bg-surface-container-low p-2 text-xs text-on-surface-variant">
                                                    USD recibido: {usdMoney(Number(usdPaid || 0))} = {money(usdPaidCrc)}
                                                </div>
                                            )}
                                            {paymentFlow === 'cash' && (
                                                <>
                                                    <div className="mt-2 flex items-center justify-between text-sm"><span>Pagado</span><span>{money(paid)}</span></div>
                                                    <div className="flex items-center justify-between text-sm"><span>Cambio CRC</span><span>{money(change)}</span></div>
                                                </>
                                            )}
                                            {paymentFlow === 'credit' && (
                                                <>
                                                    <div className="mt-2 flex items-center justify-between text-sm"><span>Abono inicial</span><span>{money(Number(creditPaid || 0) + usdPaidCrc)}</span></div>
                                                    <div className="flex items-center justify-between text-sm"><span>Saldo a credito</span><span>{money(creditBalance)}</span></div>
                                                </>
                                            )}
                                            {paymentFlow === 'mixed' && (
                                                <>
                                                    <div className="mt-2 flex items-center justify-between text-sm"><span>Pagado hoy</span><span>{money(paid)}</span></div>
                                                    <div className="flex items-center justify-between text-sm"><span>Saldo a credito</span><span>{money(creditBalance)}</span></div>
                                                </>
                                            )}
                                        </div>

                                        {currency === 'CRC' && exchangeRateUsdCrc > 0 && (
                                            <div className="rounded-lg border border-outline-variant bg-white p-3 text-sm text-on-surface-variant">
                                                Tipo de cambio actual: {usdMoney(1)} = {money(exchangeRateUsdCrc)}
                                            </div>
                                        )}

                                        {paymentError && (
                                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                                                {paymentError}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            className="w-full rounded-lg bg-secondary px-4 py-3 font-semibold text-on-secondary disabled:opacity-50"
                                            onClick={submitSale}
                                            disabled={!canSell || (paymentFlow !== 'cash' && !selectedCustomer)}
                                        >
                                            Confirmar cobro
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {invoiceDialogOpen && (
                    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 px-4">
                        <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-headline-lg text-headline-md font-bold">Abono a factura</h3>
                                    <p className="font-body-md text-body-sm text-on-surface-variant">Selecciona cliente, factura(s) y modo de aplicaciÃ³n.</p>
                                </div>
                                <button type="button" className="rounded-full p-2 hover:bg-surface-container" onClick={() => setInvoiceDialogOpen(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                                        <label className="mb-2 block text-sm font-semibold text-on-surface">Cliente</label>
                                        <input
                                            className="w-full rounded border border-outline-variant px-3 py-2"
                                            placeholder="Buscar por cÃ©dula o nombre"
                                            value={invoiceCustomerQuery}
                                            onChange={(event) => setInvoiceCustomerQuery(event.target.value)}
                                        />
                                        <div className="mt-3 max-h-52 overflow-y-auto rounded border border-outline-variant bg-white">
                                            {invoiceCustomerMatches.length ? invoiceCustomerMatches.map((customer) => (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    className={`flex w-full items-center justify-between border-b border-outline-variant px-3 py-2 text-left last:border-b-0 ${customerId === customer.id ? 'bg-secondary/10' : 'hover:bg-surface-container'}`}
                                                    onClick={() => {
                                                        setCustomerId(customer.id);
                                                        setInvoiceCustomerQuery(customer.name);
                                                        setSelectedInvoiceIds([]);
                                                        void loadPendingSales(customer.id);
                                                    }}
                                                >
                                                    <span>
                                                        <div className="font-semibold">{customer.name}</div>
                                                        <div className="text-xs text-on-surface-variant">{customer.document || 'Sin cÃ©dula'}</div>
                                                    </span>
                                                    <span className="text-xs text-on-surface-variant">Saldo {money(customer.credit_balance)}</span>
                                                </button>
                                            )) : (
                                                <div className="p-3 text-sm text-on-surface-variant">No se encontrÃ³ el cliente.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                                        <div className="mb-3 flex gap-2">
                                            <button type="button" className={`rounded px-3 py-2 text-sm font-semibold ${invoiceMode === 'auto' ? 'bg-secondary text-on-secondary' : 'bg-white border border-outline-variant'}`} onClick={() => setInvoiceMode('auto')}>
                                                AutomÃ¡tico
                                            </button>
                                            <button type="button" className={`rounded px-3 py-2 text-sm font-semibold ${invoiceMode === 'manual' ? 'bg-secondary text-on-secondary' : 'bg-white border border-outline-variant'}`} onClick={() => setInvoiceMode('manual')}>
                                                Manual
                                            </button>
                                        </div>
                                        <AmountField label="Monto a aplicar" value={invoiceAmount} onChange={setInvoiceAmount} />
                                        <div className="mt-3 text-sm text-on-surface-variant">
                                            Si el monto supera una factura, el sobrante sigue con la siguiente.
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-outline-variant bg-white p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <h4 className="font-semibold text-on-surface">Facturas pendientes</h4>
                                            <span className="text-sm text-on-surface-variant">{pendingSales.length} pendientes</span>
                                        </div>

                                        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-outline-variant">
                                            {pendingSales.length ? (
                                                <table className="min-w-full border-collapse text-sm">
                                                    <thead className="sticky top-0 z-10 bg-surface-container-low">
                                                        <tr className="border-b border-outline-variant text-left text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                                                            <th className="w-12 px-3 py-3"></th>
                                                            <th className="px-3 py-3">NÃºmero</th>
                                                            <th className="px-3 py-3">Fecha</th>
                                                            <th className="px-3 py-3 text-right">Total</th>
                                                            <th className="px-3 py-3 text-right">Abonado</th>
                                                            <th className="px-3 py-3 text-right">Saldo</th>
                                                            <th className="px-3 py-3 text-right">Aplicar ahora</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-outline-variant bg-white">
                                                        {pendingSales.map((sale) => {
                                                            const appliedValue = invoiceMode === 'manual'
                                                                ? Number(invoiceAppliedAmounts[sale.id] || 0)
                                                                : (invoicePreviewAllocations.find((row) => row.id === sale.id)?.applied ?? 0);
                                                            const isSelected = invoiceMode === 'manual' && selectedInvoiceIds.includes(sale.id);

                                                            return (
                                                                <tr key={sale.id} className={isSelected ? 'bg-secondary/10' : 'bg-white'}>
                                                                    <td className="px-3 py-3 align-top">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mt-1 h-4 w-4 rounded border-outline-variant"
                                                                            checked={isSelected}
                                                                            disabled={invoiceMode !== 'manual'}
                                                                            onChange={() => {
                                                                                if (invoiceMode !== 'manual') return;
                                                                                setSelectedInvoiceIds((current) => (
                                                                                    current.includes(sale.id)
                                                                                        ? current.filter((id) => id !== sale.id)
                                                                                        : [...current, sale.id]
                                                                                ));
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top font-semibold text-on-surface">{sale.number}</td>
                                                                    <td className="px-3 py-3 align-top text-on-surface-variant">{sale.created_at}</td>
                                                                    <td className="px-3 py-3 align-top text-right text-on-surface">{money(sale.total)}</td>
                                                                    <td className="px-3 py-3 align-top text-right text-on-surface">{money(sale.paid_amount)}</td>
                                                                    <td className="px-3 py-3 align-top text-right font-semibold text-on-surface">{money(sale.balance)}</td>
                                                                    <td className="px-3 py-3 align-top text-right">
                                                                        <input
                                                                            className="w-28 rounded border border-outline-variant bg-white px-3 py-2 text-right text-sm font-semibold"
                                                                            value={invoiceMode === 'manual' ? (invoiceAppliedAmounts[sale.id] ?? '') : moneyInput(appliedValue)}
                                                                            onChange={(event) => {
                                                                                if (invoiceMode !== 'manual') return;
                                                                                setInvoiceAppliedAmounts((current) => ({ ...current, [sale.id]: event.target.value }));
                                                                            }}
                                                                            disabled={invoiceMode === 'auto' || !isSelected}
                                                                            placeholder={invoiceMode === 'auto' ? 'Auto' : '0.00'}
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="rounded-lg border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">
                                                    El cliente no tiene facturas pendientes.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                                        <div className="text-sm font-semibold text-on-surface">Vista previa</div>
                                        <div className="mt-3 space-y-2 text-sm">
                                            {invoicePreviewAllocations.length ? invoicePreviewAllocations.map((sale) => (
                                                <div key={sale.id} className="flex items-center justify-between rounded bg-white px-3 py-2">
                                                    <span>{sale.number}</span>
                                                    <span>{money(sale.applied)}</span>
                                                </div>
                                            )) : (
                                                <div className="text-on-surface-variant">Escribe un monto para ver la distribuciÃ³n.</div>
                                            )}
                                        </div>
                                        <div className="mt-3 flex items-center justify-between font-semibold">
                                            <span>Total aplicado</span>
                                            <span>{money(invoiceMode === 'manual' ? invoiceAppliedTotal : invoicePreviewAllocations.reduce((sum, sale) => sum + sale.applied, 0))}</span>
                                        </div>
                                    </div>

                                        <button
                                            type="button"
                                            className="w-full rounded-lg bg-secondary px-4 py-3 font-semibold text-on-secondary disabled:opacity-50"
                                            disabled={!customerId || (invoiceMode === 'auto' ? invoiceAmountNumber <= 0 || invoicePreviewAllocations.length === 0 : manualAllocationPayload.length === 0)}
                                            onClick={() => {
                                                const paymentPayload = {
                                                    customer_id: customerId,
                                                    amount: invoiceMode === 'manual'
                                                        ? manualAllocationPayload.reduce((sum, row) => sum + row.amount, 0)
                                                        : invoiceAmountNumber,
                                                    mode: invoiceMode,
                                                    sale_ids: invoiceMode === 'manual' ? selectedInvoiceIds : [],
                                                    allocations: invoiceMode === 'manual' ? manualAllocationPayload : [],
                                                };

                                                printTicketWindow.current = autoPrintReceipts
                                                    ? window.open('', '_blank', 'width=420,height=800')
                                                    : null;

                                                if (!isOnline) {
                                                    void enqueueOfflineItem('credit_payment', paymentPayload);
                                                    setInvoiceDialogOpen(false);
                                                    setInvoiceAmount('');
                                                    setSelectedInvoiceIds([]);
                                                    setInvoiceAppliedAmounts({});
                                                    setStatusBanner('Abono guardado sin internet. Se sincronizara al volver la conexion.');
                                                    return;
                                                }

                                                router.post(route('pos.credit-payments.store'), paymentPayload, {
                                                    preserveScroll: true,
                                                    onSuccess: () => {
                                                        setInvoiceDialogOpen(false);
                                                        setInvoiceAmount('');
                                                        setSelectedInvoiceIds([]);
                                                        setInvoiceAppliedAmounts({});
                                                    },
                                                });
                                            }}
                                        >
                                        Aplicar abono
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function TotalRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between font-body-md text-body-md text-on-surface-variant">
            <span>{label}</span>
            <span className="font-mono-md">{value}</span>
        </div>
    );
}

function Hotkey({ keyName, label }: { keyName: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono-md text-[11px] font-bold">{keyName}</span>
            <span className="font-label-md text-[11px] uppercase">{label}</span>
        </div>
    );
}

function productTone(category: string | null) {
    const text = (category ?? '').toLowerCase();
    if (text.includes('elect')) return 'bg-blue-50 border-blue-200 text-blue-800';
    if (text.includes('hogar')) return 'bg-green-50 border-green-200 text-green-800';
    if (text.includes('office') || text.includes('oficina')) return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-gray-50 border-outline-variant text-on-surface';
}

function AmountField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{label}</span>
            <input className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
    );
}

function PaymentCard({
    active,
    title,
    description,
    icon,
    onClick,
}: {
    active: boolean;
    title: string;
    description: string;
    icon: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border p-4 text-left transition-all ${active ? 'border-secondary bg-secondary/10 shadow-md' : 'border-outline-variant bg-white hover:bg-surface-container'}`}
        >
            <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined rounded-full p-2 ${active ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-outline'}`}>{icon}</span>
                <div>
                    <div className="font-headline-md text-body-lg font-bold text-on-surface">{title}</div>
                    <div className="mt-1 text-sm text-on-surface-variant">{description}</div>
                </div>
            </div>
        </button>
    );
}

