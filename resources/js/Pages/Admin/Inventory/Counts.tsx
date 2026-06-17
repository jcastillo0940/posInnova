import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useDeferredValue, useRef, useState } from 'react';
import { FieldInput } from './Partials/Fields';
import InventoryTabs from './Partials/InventoryTabs';
import { Product, StockCount } from './types';

type Props = {
    products: Product[];
    stockCounts: StockCount[];
};

export default function InventoryCounts({ products, stockCounts }: Props) {
    const countedInputRef = useRef<HTMLInputElement | null>(null);
    const [search, setSearch] = useState('');
    const [scanCode, setScanCode] = useState('');
    const [scanMessage, setScanMessage] = useState('');
    const deferredSearch = useDeferredValue(search);
    const countForm = useForm({
        product_id: products[0]?.id ?? 0,
        counted_quantity: products[0]?.stock ?? 0,
        reason: '',
    });

    const selectedProduct = products.find((product) => product.id === Number(countForm.data.product_id));
    const difference = selectedProduct ? Number(countForm.data.counted_quantity || 0) - selectedProduct.stock : 0;
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const filteredProducts = products
        .filter((product) => {
            if (!normalizedSearch) return true;

            return [
                product.name,
                product.barcode,
                product.category ?? '',
                product.variant ?? '',
                product.shade ?? '',
                product.size ?? '',
            ].some((value) => value.toLowerCase().includes(normalizedSearch));
        })
        .slice(0, 80);

    const selectProductForManualCount = (product: Product) => {
        countForm.setData({
            ...countForm.data,
            product_id: product.id,
            counted_quantity: product.stock,
        });
        setScanMessage(`${product.name} seleccionado para conteo manual.`);
        window.setTimeout(() => countedInputRef.current?.select(), 0);
    };

    const handleBarcodeScan = () => {
        const code = scanCode.trim();
        if (!code) return;

        const product = products.find((item) => item.barcode.toLowerCase() === code.toLowerCase());
        if (!product) {
            setScanMessage(`No encontre producto con codigo ${code}.`);
            setScanCode('');
            return;
        }

        const isSameProduct = Number(countForm.data.product_id) === product.id;
        countForm.setData({
            ...countForm.data,
            product_id: product.id,
            counted_quantity: isSameProduct ? Number(countForm.data.counted_quantity || 0) + 1 : 1,
        });
        setSearch(product.barcode);
        setScanMessage(isSameProduct ? `${product.name}: +1 unidad contada.` : `${product.name} seleccionado por escaner.`);
        setScanCode('');
        window.setTimeout(() => countedInputRef.current?.select(), 0);
    };

    const saveCount = () => {
        countForm.post(route('admin.inventory.counts.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setScanMessage('Conteo guardado correctamente.');
                countForm.setData('reason', '');
            },
        });
    };

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Inventario</p>
                    <h2 className="text-headline-lg text-on-surface">Conteo fisico</h2>
                </div>
            )}
        >
            <Head title="Conteo fisico" />
            <InventoryTabs />

            <div className="space-y-4">
                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                        <div>
                            <h3 className="text-headline-md text-on-surface">Buscar y seleccionar producto</h3>
                            <p className="mt-1 text-body-sm text-on-surface-variant">
                                Busca por nombre, codigo, categoria, tono o variante. El escaner funciona pegando el codigo y presionando Enter.
                            </p>

                            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                                    <input
                                        className="w-full rounded-lg border border-outline bg-surface py-3 pl-10 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Buscar producto, SKU, categoria..."
                                    />
                                </div>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">barcode_scanner</span>
                                    <input
                                        className="w-full rounded-lg border border-secondary bg-secondary-container py-3 pl-10 pr-3 font-mono text-body-md text-on-secondary-container placeholder:text-on-surface-variant"
                                        value={scanCode}
                                        onChange={(event) => setScanCode(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                handleBarcodeScan();
                                            }
                                        }}
                                        placeholder="Escanear codigo + Enter"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            {scanMessage && (
                                <p className="mt-3 rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
                                    {scanMessage}
                                </p>
                            )}

                            <div className="mt-4 max-h-[440px] overflow-y-auto rounded-lg border border-outline-variant">
                                {filteredProducts.length ? filteredProducts.map((product) => {
                                    const active = selectedProduct?.id === product.id;
                                    return (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => selectProductForManualCount(product)}
                                            className={`flex w-full items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 text-left transition last:border-b-0 ${
                                                active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface hover:bg-surface-container-low'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-on-surface">{product.name}</p>
                                                <p className="mt-1 font-mono text-[11px] text-on-surface-variant">
                                                    {product.barcode} | {product.category ?? 'Sin categoria'}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-label-md text-on-surface-variant">Sistema</p>
                                                <p className="text-headline-md font-bold text-on-surface">{product.stock}</p>
                                            </div>
                                        </button>
                                    );
                                }) : (
                                    <p className="px-4 py-6 text-center text-body-sm text-on-surface-variant">
                                        No encontre productos con esa busqueda.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                            <p className="text-label-md text-on-surface-variant">Producto seleccionado</p>
                            <h3 className="mt-1 text-headline-md font-bold text-on-surface">
                                {selectedProduct?.name ?? 'Selecciona un producto'}
                            </h3>
                            <p className="mt-1 font-mono text-body-sm text-on-surface-variant">
                                {selectedProduct ? `${selectedProduct.barcode} | ${selectedProduct.category ?? 'Sin categoria'}` : 'Busca o escanea para iniciar'}
                            </p>

                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Metric label="Sistema" value={selectedProduct?.stock ?? 0} />
                                <Metric label="Fisico" value={countForm.data.counted_quantity} />
                                <Metric label="Diferencia" value={difference} tone={difference === 0 ? 'neutral' : difference > 0 ? 'positive' : 'negative'} />
                            </div>

                            <div className="mt-5 space-y-3">
                                <label className="block">
                                    <span className="mb-1 block text-label-md text-on-surface-variant">Cantidad fisica contada</span>
                                    <input
                                        ref={countedInputRef}
                                        className="w-full rounded-lg border border-outline bg-surface px-4 py-4 text-center font-mono text-display-sm font-bold text-on-surface"
                                        type="number"
                                        value={countForm.data.counted_quantity}
                                        onChange={(event) => countForm.setData('counted_quantity', Number(event.target.value))}
                                    />
                                </label>

                                <div className="grid gap-2 sm:grid-cols-3">
                                    <button
                                        type="button"
                                        className="rounded border border-outline bg-surface px-3 py-2 text-label-md font-semibold text-on-surface"
                                        disabled={!selectedProduct}
                                        onClick={() => countForm.setData('counted_quantity', selectedProduct?.stock ?? 0)}
                                    >
                                        Igual al sistema
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded border border-outline bg-surface px-3 py-2 text-label-md font-semibold text-on-surface"
                                        disabled={!selectedProduct}
                                        onClick={() => countForm.setData('counted_quantity', Number(countForm.data.counted_quantity || 0) + 1)}
                                    >
                                        Sumar 1
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded border border-outline bg-surface px-3 py-2 text-label-md font-semibold text-on-surface"
                                        disabled={!selectedProduct}
                                        onClick={() => countForm.setData('counted_quantity', 0)}
                                    >
                                        Poner 0
                                    </button>
                                </div>

                                <FieldInput value={countForm.data.reason} onChange={(value) => countForm.setData('reason', value)} placeholder="Motivo / nota" />

                                <button
                                    className="w-full rounded-lg bg-primary px-4 py-3 text-body-md font-semibold text-on-primary disabled:opacity-60"
                                    disabled={countForm.processing || !selectedProduct}
                                    onClick={saveCount}
                                >
                                    Guardar conteo fisico
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Historial de conteos</h3>
                    <div className="mt-4 space-y-3">
                        {stockCounts.length ? stockCounts.map((count, index) => (
                            <div key={`${count.product}-${index}`} className="rounded border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-on-surface">{count.product ?? 'Producto'}</span>
                                    <span>{count.created_at ?? 'sin fecha'}</span>
                                </div>
                                <p className="mt-1">Contado {count.counted_quantity} | Sistema {count.system_quantity} | Dif {count.difference}</p>
                                {count.reason && <p className="mt-1 text-label-md text-on-surface-variant">{count.reason}</p>}
                            </div>
                        )) : <p className="text-body-sm text-on-surface-variant">Sin conteos todavia.</p>}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Metric({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: string | number;
    tone?: 'neutral' | 'positive' | 'negative';
}) {
    const toneClass = tone === 'positive'
        ? 'text-secondary'
        : tone === 'negative'
            ? 'text-error'
            : 'text-on-surface';

    return (
        <div className="rounded border border-outline-variant bg-surface px-3 py-3 text-center">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <p className={`mt-1 text-headline-md font-bold ${toneClass}`}>{value}</p>
        </div>
    );
}
