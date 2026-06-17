import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, usePage } from '@inertiajs/react';
import InventoryTabs from './Partials/InventoryTabs';
import { Product } from './types';

type Props = {
    products: Product[];
};

export default function InventoryProducts({ products }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const money = (value: number | string) => formatMoney(value, moneySettings.currency || 'CRC');
    const inventoryCost = products.reduce((sum, product) => sum + Number(product.cost) * product.stock, 0);
    const inventoryValue = products.reduce((sum, product) => sum + Number(product.price) * product.stock, 0);

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Inventario</p>
                    <h2 className="text-headline-lg text-on-surface">Productos</h2>
                </div>
            )}
        >
            <Head title="Productos" />
            <InventoryTabs />

            <div className="space-y-4">
                <section className="grid gap-4 md:grid-cols-3">
                    <Metric label="Productos" value={products.length} />
                    <Metric label="Costo inventario" value={money(inventoryCost)} />
                    <Metric label="Valor de venta" value={money(inventoryValue)} />
                </section>

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Catalogo y rentabilidad</h3>
                    <div className="mt-4 overflow-auto rounded border border-outline-variant">
                        <table className="min-w-full text-body-sm">
                            <thead className="bg-surface-container-low text-on-surface-variant">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Producto</th>
                                    <th className="px-4 py-3 text-left font-semibold">Codigo</th>
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
                                        <td className="px-4 py-3 text-on-surface-variant">{product.barcode}</td>
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
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return (
        <article className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <p className="mt-2 text-headline-lg font-bold text-on-surface">{value}</p>
        </article>
    );
}
