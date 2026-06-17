import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FieldInput, FieldSelect } from './Partials/Fields';
import InventoryTabs from './Partials/InventoryTabs';
import { InventoryMovement, Product } from './types';

type Props = {
    products: Product[];
    movements: InventoryMovement[];
};

export default function InventoryAdjustments({ products, movements }: Props) {
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

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Inventario</p>
                    <h2 className="text-headline-lg text-on-surface">Ajustes de inventario</h2>
                </div>
            )}
        >
            <Head title="Ajustes de inventario" />
            <InventoryTabs />

            <div className="space-y-4">
                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="text-headline-md text-on-surface">Entrada o salida manual</h3>
                            <p className="mt-1 text-body-sm text-on-surface-variant">
                                Usa positivo para entrada y negativo para salida. Para conteo fisico exacto usa la vista Conteo fisico.
                            </p>
                        </div>
                        <button
                            className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary disabled:opacity-60"
                            disabled={adjustmentForm.processing || adjustmentForm.data.quantity === 0}
                            onClick={() => adjustmentForm.post(route('admin.inventory.adjust'), {
                                preserveScroll: true,
                            })}
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

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Ajustes recientes</h3>
                    <div className="mt-4 space-y-3">
                        {movements.length ? movements.map((movement, index) => (
                            <div key={`${movement.type}-${index}`} className="rounded border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-on-surface">{movement.product ?? 'Producto'}</span>
                                    <span>{movement.created_at ?? 'sin fecha'}</span>
                                </div>
                                <p className="mt-1">{movement.type} | {movement.quantity} | {movement.before} -&gt; {movement.after} | costo {money(movement.unit_cost)}</p>
                            </div>
                        )) : <p className="text-body-sm text-on-surface-variant">Sin ajustes todavia.</p>}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
