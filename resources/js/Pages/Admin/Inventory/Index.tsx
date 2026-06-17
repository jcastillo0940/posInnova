import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, useForm, usePage } from '@inertiajs/react';

type Product = {
    id: number;
    name: string;
    barcode: string;
    category: string | null;
    variant: string | null;
    shade: string | null;
    size: string | null;
    lot_number: string | null;
    expires_at: string | null;
    stock: number;
    min_stock: number;
    cost: string;
    price: string;
};

type PurchaseLine = {
    product_id: string;
    name: string;
    barcode: string;
    category: string;
    quantity: number;
    unit_cost: string;
    sale_price: string;
};

type Props = {
    products: Product[];
    movements: Array<{ type: string; product: string | null; quantity: number; before: number; after: number; unit_cost: string; created_at: string | null }>;
    stockCounts: Array<{ product: string | null; counted_quantity: number; system_quantity: number; difference: number; reason: string | null; created_at: string | null }>;
    suppliers: Array<{ id: number; name: string }>;
    purchaseOrders: Array<{ id: number; number: string; supplier: string | null; invoice_number: string | null; items_count: number; total: string; received_at: string | null }>;
};

const blankPurchaseLine: PurchaseLine = {
    product_id: '',
    name: '',
    barcode: '',
    category: '',
    quantity: 1,
    unit_cost: '0.00',
    sale_price: '',
};

export default function InventoryIndex({ products, movements, stockCounts, suppliers, purchaseOrders }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const money = (value: number | string) => formatMoney(value, moneySettings.currency || 'CRC');
    const adjustmentForm = useForm({
        product_id: products[0]?.id ?? 0,
        quantity: 0,
        reason: '',
        variant: '',
        shade: '',
        size: '',
        lot_number: '',
        expires_at: '',
        min_stock: 0,
    });
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
        return sum + Number(item.unit_cost || 0) * Number(item.quantity || 0);
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
                    <h2 className="text-headline-lg text-on-surface">Compras, costos, Kardex y conteo fisico</h2>
                </div>
            )}
        >
            <Head title="Inventario" />

            <div className="space-y-4">
                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="text-headline-md text-on-surface">Orden de compra recibida</h3>
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

                    <div className="mt-4 overflow-hidden rounded border border-outline-variant">
                        <table className="min-w-full text-body-sm">
                            <thead className="bg-surface-container-low text-on-surface-variant">
                                <tr>
                                    <th className="px-3 py-3 text-left font-semibold">Producto existente</th>
                                    <th className="px-3 py-3 text-left font-semibold">Nombre nuevo</th>
                                    <th className="px-3 py-3 text-left font-semibold">Codigo</th>
                                    <th className="px-3 py-3 text-left font-semibold">Categoria</th>
                                    <th className="px-3 py-3 text-left font-semibold">Cant.</th>
                                    <th className="px-3 py-3 text-left font-semibold">Costo</th>
                                    <th className="px-3 py-3 text-left font-semibold">Precio venta</th>
                                    <th className="px-3 py-3 text-right font-semibold">Total</th>
                                    <th className="px-3 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant bg-surface">
                                {purchaseForm.data.items.map((item, index) => (
                                    <tr key={index}>
                                        <td className="px-3 py-3">
                                            <FieldSelect
                                                value={item.product_id}
                                                onChange={(value) => selectPurchaseProduct(index, value)}
                                                options={[
                                                    { value: '', label: 'Producto nuevo' },
                                                    ...products.map((product) => ({ value: String(product.id), label: `${product.name} (${product.stock})` })),
                                                ]}
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
                                            <FieldInput value={item.unit_cost} onChange={(value) => updatePurchaseLine(index, 'unit_cost', value)} placeholder="Costo" type="number" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <FieldInput value={item.sale_price} onChange={(value) => updatePurchaseLine(index, 'sale_price', value)} placeholder="Precio" type="number" />
                                        </td>
                                        <td className="px-3 py-3 text-right font-semibold text-on-surface">
                                            {money(Number(item.unit_cost || 0) * Number(item.quantity || 0))}
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
                            disabled={purchaseForm.processing || purchaseForm.data.items.some((item) => Number(item.quantity) <= 0 || Number(item.unit_cost) < 0)}
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
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="text-headline-md text-on-surface">Ajuste y conteo</h3>
                            <p className="mt-1 text-body-sm text-on-surface-variant">
                                Registra entradas, salidas y conteos sin salir del flujo operativo.
                            </p>
                        </div>
                        <button
                            className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary disabled:opacity-60"
                            disabled={adjustmentForm.processing || adjustmentForm.data.quantity === 0}
                            onClick={() => adjustmentForm.post(route('admin.inventory.adjust'))}
                        >
                            Guardar ajuste
                        </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <FieldSelect value={String(adjustmentForm.data.product_id)} onChange={(value) => adjustmentForm.setData('product_id', Number(value))} options={products.map((product) => ({ value: String(product.id), label: product.name }))} />
                        <FieldInput value={adjustmentForm.data.quantity} onChange={(value) => adjustmentForm.setData('quantity', Number(value))} placeholder="+/- cantidad" type="number" />
                        <FieldInput value={adjustmentForm.data.reason} onChange={(value) => adjustmentForm.setData('reason', value)} placeholder="Motivo" />
                        <FieldInput value={adjustmentForm.data.variant} onChange={(value) => adjustmentForm.setData('variant', value)} placeholder="Variante" />
                        <FieldInput value={adjustmentForm.data.shade} onChange={(value) => adjustmentForm.setData('shade', value)} placeholder="Tono/color" />
                        <FieldInput value={adjustmentForm.data.size} onChange={(value) => adjustmentForm.setData('size', value)} placeholder="Tamano" />
                        <FieldInput value={adjustmentForm.data.lot_number} onChange={(value) => adjustmentForm.setData('lot_number', value)} placeholder="Lote" />
                        <FieldInput value={adjustmentForm.data.expires_at} onChange={(value) => adjustmentForm.setData('expires_at', value)} placeholder="Vencimiento" type="date" />
                        <FieldInput value={adjustmentForm.data.min_stock} onChange={(value) => adjustmentForm.setData('min_stock', Number(value))} placeholder="Min stock" type="number" />
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                        <h3 className="text-headline-md text-on-surface">Productos</h3>
                        <div className="mt-4 overflow-hidden rounded border border-outline-variant">
                            <table className="min-w-full text-body-sm">
                                <thead className="bg-surface-container-low text-on-surface-variant">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Producto</th>
                                        <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                                        <th className="px-4 py-3 text-left font-semibold">Variante</th>
                                        <th className="px-4 py-3 text-left font-semibold">Lote</th>
                                        <th className="px-4 py-3 text-left font-semibold">Vence</th>
                                        <th className="px-4 py-3 text-left font-semibold">Stock</th>
                                        <th className="px-4 py-3 text-left font-semibold">Costo</th>
                                        <th className="px-4 py-3 text-left font-semibold">Precio</th>
                                        <th className="px-4 py-3 text-left font-semibold">Ganancia/u</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant bg-surface">
                                    {products.map((product) => (
                                        <tr key={product.id} className="transition hover:bg-surface-container-low">
                                            <td className="px-4 py-3 font-semibold text-on-surface">{product.name}</td>
                                            <td className="px-4 py-3 text-on-surface-variant">{product.category ?? '-'}</td>
                                            <td className="px-4 py-3 text-on-surface-variant">{[product.variant, product.shade, product.size].filter(Boolean).join(' / ') || '-'}</td>
                                            <td className="px-4 py-3 text-on-surface-variant">{product.lot_number ?? '-'}</td>
                                            <td className="px-4 py-3 text-on-surface-variant">{product.expires_at ?? '-'}</td>
                                            <td className="px-4 py-3 text-on-surface">
                                                {product.stock} {product.min_stock > 0 ? `(min ${product.min_stock})` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-on-surface-variant">{money(product.cost)}</td>
                                            <td className="px-4 py-3 text-on-surface-variant">{money(product.price)}</td>
                                            <td className="px-4 py-3 font-semibold text-secondary">{money(Number(product.price) - Number(product.cost))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                        <h3 className="text-headline-md text-on-surface">Conteo fisico</h3>
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
                    </div>
                </section>

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Ordenes de compra recientes</h3>
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

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Kardex reciente</h3>
                    <div className="mt-4 space-y-3">
                        {movements.length ? movements.map((movement, index) => (
                            <div key={`${movement.type}-${index}`} className="rounded border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-on-surface">{movement.product ?? 'Producto'}</span>
                                    <span>{movement.created_at ?? 'sin fecha'}</span>
                                </div>
                                <p className="mt-1">{movement.type} | {movement.quantity} | {movement.before} -&gt; {movement.after} | costo {money(movement.unit_cost)}</p>
                            </div>
                        )) : <p className="text-body-sm text-on-surface-variant">Sin movimientos todavia.</p>}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function FieldInput({ value, onChange, placeholder, type = 'text' }: { value: string | number; onChange: (value: string) => void; placeholder: string; type?: string }) {
    return <input className="rounded border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

function FieldSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
    return (
        <select className="rounded border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface" value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
    );
}
