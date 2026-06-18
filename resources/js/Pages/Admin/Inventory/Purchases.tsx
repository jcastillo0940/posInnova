import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney, usdToCrc } from '@/lib/money';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FieldInput, FieldSelect } from './Partials/Fields';
import { ProductCombobox } from './Partials/ProductCombobox';
import InventoryTabs from './Partials/InventoryTabs';
import { Product, PurchaseOrderSummary, SupplierOption } from './types';

type PurchaseLine = {
    product_id: string;
    name: string;
    barcode: string;
    category: string;
    quantity: number;
    unit_cost: string;
    cost_currency: 'CRC' | 'USD';
    exchange_rate_usd_crc: string;
    sale_price: string;
};

type Props = {
    products: Product[];
    suppliers: SupplierOption[];
    purchaseOrders: PurchaseOrderSummary[];
};

const blankPurchaseLine: PurchaseLine = {
    product_id: '',
    name: '',
    barcode: '',
    category: '',
    quantity: 1,
    unit_cost: '0',
    cost_currency: 'CRC',
    exchange_rate_usd_crc: '',
    sale_price: '',
};

export default function InventoryPurchases({ products, suppliers, purchaseOrders }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const currency = moneySettings.currency || 'CRC';
    const exchangeRateUsdCrc = moneySettings.exchangeRateUsdCrc || 0;
    const money = (value: number | string) => formatMoney(value, currency);
    const purchaseForm = useForm<{
        supplier_id: string;
        supplier_name: string;
        invoice_number: string;
        notes: string;
        items: PurchaseLine[];
    }>({
        supplier_id: '',
        supplier_name: '',
        invoice_number: '',
        notes: '',
        items: [{ ...blankPurchaseLine }],
    });

    const purchaseTotal = purchaseForm.data.items.reduce((sum, item) => {
        const unitCostCrc = item.cost_currency === 'USD'
            ? usdToCrc(item.unit_cost, item.exchange_rate_usd_crc || exchangeRateUsdCrc)
            : Number(item.unit_cost || 0);

        return sum + unitCostCrc * Number(item.quantity || 0);
    }, 0);

    const updatePurchaseLine = (index: number, key: keyof PurchaseLine, value: string | number) => {
        purchaseForm.setData('items', purchaseForm.data.items.map((item, currentIndex) => (
            currentIndex === index ? { ...item, [key]: value } : item
        )));
    };

    const selectPurchaseProduct = (index: number, value: string) => {
        const product = products.find((item) => item.id === Number(value));

        purchaseForm.setData('items', purchaseForm.data.items.map((item, currentIndex) => {
            if (currentIndex !== index) return item;
            if (!product) return { ...item, product_id: value };

            return {
                ...item,
                product_id: String(product.id),
                name: product.name,
                barcode: product.barcode,
                category: product.category ?? '',
                unit_cost: product.cost,
                cost_currency: 'CRC',
                exchange_rate_usd_crc: exchangeRateUsdCrc ? String(exchangeRateUsdCrc) : '',
                sale_price: product.price,
            };
        }));
    };

    const resetPurchaseForm = () => {
        purchaseForm.setData({
            supplier_id: '',
            supplier_name: '',
            invoice_number: '',
            notes: '',
            items: [{ ...blankPurchaseLine }],
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Inventario</p>
                    <h2 className="text-headline-lg text-on-surface">Ordenes de compra</h2>
                </div>
            )}
        >
            <Head title="Ordenes de compra" />
            <InventoryTabs />

            <div className="space-y-4">
                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="text-headline-md text-on-surface">Recibir compra</h3>
                            <p className="mt-1 text-body-sm text-on-surface-variant">
                                Registra productos comprados, costo real y precio de venta. Al guardar, el stock entra al inventario.
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-label-md text-on-surface-variant">Total compra</p>
                            <p className="text-headline-md font-bold text-secondary">{money(purchaseTotal)}</p>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-4">
                        <FieldSelect
                            value={purchaseForm.data.supplier_id}
                            onChange={(value) => purchaseForm.setData('supplier_id', value)}
                            options={[
                                { value: '', label: 'Proveedor nuevo/manual' },
                                ...suppliers.map((supplier) => ({ value: String(supplier.id), label: supplier.name })),
                            ]}
                        />
                        <FieldInput value={purchaseForm.data.supplier_name} onChange={(value) => purchaseForm.setData('supplier_name', value)} placeholder="Nombre proveedor" />
                        <FieldInput value={purchaseForm.data.invoice_number} onChange={(value) => purchaseForm.setData('invoice_number', value)} placeholder="Factura / referencia" />
                        <FieldInput value={purchaseForm.data.notes} onChange={(value) => purchaseForm.setData('notes', value)} placeholder="Notas" />
                    </div>

                    <div className="mt-4 overflow-auto rounded border border-outline-variant">
                        <table className="min-w-full text-body-sm">
                            <thead className="bg-surface-container-low text-on-surface-variant">
                                <tr>
                                    <th className="px-3 py-3 text-left font-semibold">Producto existente</th>
                                    <th className="px-3 py-3 text-left font-semibold">Nombre nuevo</th>
                                    <th className="px-3 py-3 text-left font-semibold">Codigo</th>
                                    <th className="px-3 py-3 text-left font-semibold">Categoria</th>
                                    <th className="px-3 py-3 text-left font-semibold">Cant.</th>
                                    <th className="px-3 py-3 text-left font-semibold">Moneda costo</th>
                                    <th className="px-3 py-3 text-left font-semibold">Costo</th>
                                    <th className="px-3 py-3 text-left font-semibold">Tipo cambio</th>
                                    <th className="px-3 py-3 text-left font-semibold">Costo CRC</th>
                                    <th className="px-3 py-3 text-left font-semibold">Precio venta</th>
                                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                                    <th className="px-3 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant bg-surface">
                                {purchaseForm.data.items.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-3 py-3">
                                            <ProductCombobox
                                                value={item.product_id}
                                                onChange={(value) => selectPurchaseProduct(index, value)}
                                                options={[
                                                    { value: '', label: 'Producto nuevo' },
                                                    ...products.map((product) => ({ value: String(product.id), label: `${product.name} (${product.barcode}) Stock: ${product.stock}` })),
                                                ]}
                                                placeholder="Buscar producto..."
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput value={item.name} onChange={(value) => updatePurchaseLine(index, 'name', value)} placeholder="Nombre" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput value={item.barcode} onChange={(value) => updatePurchaseLine(index, 'barcode', value)} placeholder="SKU/codigo" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput value={item.category} onChange={(value) => updatePurchaseLine(index, 'category', value)} placeholder="Categoria" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput value={item.quantity} onChange={(value) => updatePurchaseLine(index, 'quantity', Number(value))} placeholder="Cant." type="number" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldSelect
                                                value={item.cost_currency}
                                                onChange={(value) => purchaseForm.setData('items', purchaseForm.data.items.map((line, currentIndex) => (
                                                    currentIndex === index
                                                        ? {
                                                            ...line,
                                                            cost_currency: value as 'CRC' | 'USD',
                                                            exchange_rate_usd_crc: value === 'USD' && !line.exchange_rate_usd_crc && exchangeRateUsdCrc
                                                                ? String(exchangeRateUsdCrc)
                                                                : line.exchange_rate_usd_crc,
                                                        }
                                                        : line
                                                )))}
                                                options={[
                                                    { value: 'CRC', label: 'CRC' },
                                                    { value: 'USD', label: 'USD' },
                                                ]}
                                            />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput value={item.unit_cost} onChange={(value) => updatePurchaseLine(index, 'unit_cost', value)} placeholder="Costo" type="number" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput
                                                value={item.exchange_rate_usd_crc || (item.cost_currency === 'USD' && exchangeRateUsdCrc ? String(exchangeRateUsdCrc) : '')}
                                                onChange={(value) => updatePurchaseLine(index, 'exchange_rate_usd_crc', value)}
                                                placeholder="USD a CRC"
                                                type="number"
                                            />
                                        </td>
                                        <td className="px-3 py-3 font-semibold text-on-surface">
                                            {money(item.cost_currency === 'USD' ? usdToCrc(item.unit_cost, item.exchange_rate_usd_crc || exchangeRateUsdCrc) : Number(item.unit_cost || 0))}
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput value={item.sale_price} onChange={(value) => updatePurchaseLine(index, 'sale_price', value)} placeholder="Precio" type="number" />
                                        </td>
                                        <td className="px-3 py-3 text-right font-semibold text-on-surface">
                                            {money((item.cost_currency === 'USD' ? usdToCrc(item.unit_cost, item.exchange_rate_usd_crc || exchangeRateUsdCrc) : Number(item.unit_cost || 0)) * Number(item.quantity || 0))}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <button
                                                type="button"
                                                className="rounded border border-outline px-2 py-1 text-label-md text-on-surface-variant disabled:opacity-40"
                                                disabled={purchaseForm.data.items.length === 1}
                                                onClick={() => purchaseForm.setData('items', purchaseForm.data.items.filter((_, currentIndex) => currentIndex !== index))}
                                            >
                                                Quitar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-between gap-3">
                        <button
                            type="button"
                            className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface"
                            onClick={() => purchaseForm.setData('items', [...purchaseForm.data.items, { ...blankPurchaseLine }])}
                        >
                            Agregar linea
                        </button>
                        <button
                            type="button"
                            className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary disabled:opacity-60"
                            disabled={purchaseForm.processing || purchaseForm.data.items.some((item) => Number(item.quantity) <= 0 || Number(item.unit_cost) < 0 || (item.cost_currency === 'USD' && Number(item.exchange_rate_usd_crc || exchangeRateUsdCrc) <= 0))}
                            onClick={() => purchaseForm.post(route('admin.purchase-orders.store'), {
                                preserveScroll: true,
                                onSuccess: resetPurchaseForm,
                            })}
                        >
                            Recibir compra y actualizar inventario
                        </button>
                    </div>
                </section>

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Compras recientes</h3>
                    <div className="mt-4 space-y-3">
                        {purchaseOrders.length ? purchaseOrders.map((order) => (
                            <div key={order.id} className="rounded border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-on-surface">{order.number} | {order.supplier ?? 'Sin proveedor'}</span>
                                    <span className="font-semibold text-on-surface">{money(order.total)}</span>
                                </div>
                                <p className="mt-1">{order.items_count} productos | Factura {order.invoice_number ?? 'N/D'} | {order.received_at ?? 'sin fecha'}</p>
                            </div>
                        )) : <p className="text-body-sm text-on-surface-variant">Sin compras registradas todavia.</p>}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
