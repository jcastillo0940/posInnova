import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';

type Props = {
    metrics: {
        salesToday: number;
        salesTotal: string;
        grossProfit: string;
        inventoryCost: string;
        lowStock: number;
        auditEntries: number;
    };
    openCashSession: {
        id: number;
        cash_register: string | null;
        branch: string | null;
        status: string;
        current_cash: string;
        opened_at: string | null;
    } | null;
    recentAudits: Array<{
        action: string;
        subject_type: string | null;
        subject_id: number | null;
        created_at: string | null;
    }>;
    recentSales: Array<{
        id: number;
        number: string;
        total: string;
        status: string;
        created_at: string | null;
    }>;
};

export default function ReportsIndex({ metrics, openCashSession, recentAudits, recentSales }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const money = (value: number | string) => formatMoney(value, moneySettings.currency || 'CRC');
    const { data, setData, processing } = useForm({ reason: '' });

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Administracion</p>
                    <h2 className="text-headline-lg text-on-surface">Reportes y auditoria</h2>
                </div>
            )}
        >
            <Head title="Reportes y auditoria" />

            <div className="space-y-4">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Ventas hoy" value={metrics.salesToday} />
                    <MetricCard label="Total vendido" value={money(metrics.salesTotal)} />
                    <MetricCard label="Ganancia bruta" value={money(metrics.grossProfit)} />
                    <MetricCard label="Costo inventario" value={money(metrics.inventoryCost)} />
                    <MetricCard label="Stock bajo" value={metrics.lowStock} />
                    <MetricCard label="Entradas bitacora" value={metrics.auditEntries} />
                </section>

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-headline-md text-on-surface">Caja y arqueo</h3>
                            <p className="text-body-sm text-on-surface-variant">Cierres, diferencias y reportes X/Z.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Link href={route('admin.cash.index')} className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary">
                                Abrir modulo de caja
                            </Link>
                            <Link href={route('admin.settings.index')} className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface">
                                Configuracion
                            </Link>
                        </div>
                    </div>

                    {openCashSession ? (
                        <div className="mt-4 rounded border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-on-surface">{openCashSession.cash_register ?? 'Caja'} | {openCashSession.branch ?? 'Sucursal'}</p>
                                    <p className="mt-1">Abierta desde {openCashSession.opened_at ?? 'N/D'} | Efectivo actual {money(openCashSession.current_cash)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Link href={route('admin.cash.x', openCashSession.id)} className="rounded border border-outline px-3 py-2 text-label-md text-on-surface">
                                        Ver X
                                    </Link>
                                    <Link href={route('admin.cash.z', openCashSession.id)} className="rounded border border-outline px-3 py-2 text-label-md text-on-surface">
                                        Ver Z
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-body-sm text-on-surface-variant">No hay sesion abierta actualmente.</p>
                    )}
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                    <Panel title="Bitacora reciente">
                        {recentAudits.length ? recentAudits.map((item, index) => (
                            <ListRow key={`${item.action}-${index}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-on-surface">{item.action}</span>
                                    <span>{item.created_at ?? 'sin fecha'}</span>
                                </div>
                                <p className="mt-1">
                                    {item.subject_type ?? 'Registro'} {item.subject_id ? `#${item.subject_id}` : ''}
                                </p>
                            </ListRow>
                        )) : <p className="text-body-sm text-on-surface-variant">Todavia no hay eventos de auditoria.</p>}
                    </Panel>

                    <Panel title="Ventas recientes">
                        {recentSales.length ? recentSales.map((sale) => (
                            <ListRow key={sale.id}>
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-on-surface">{sale.number}</span>
                                    <span className="font-semibold text-on-surface">{money(sale.total)}</span>
                                </div>
                                <p className="mt-1">{sale.status} | {sale.created_at ?? 'sin fecha'}</p>
                                {sale.status !== 'voided' && (
                                    <form
                                        className="mt-3 flex gap-3"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            router.post(route('admin.sales.void', sale.id), {
                                                reason: data.reason || 'Anulacion administrativa',
                                            }, {
                                                preserveScroll: true,
                                            });
                                        }}
                                    >
                                        <input
                                            className="flex-1 rounded border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant"
                                            placeholder="Motivo de anulacion"
                                            value={data.reason}
                                            onChange={(e) => setData('reason', e.target.value)}
                                        />
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="rounded bg-error-container px-4 py-2 text-body-sm font-semibold text-on-error-container disabled:opacity-60"
                                        >
                                            Anular
                                        </button>
                                    </form>
                                )}
                            </ListRow>
                        )) : <p className="text-body-sm text-on-surface-variant">Sin ventas todavia.</p>}
                    </Panel>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
    return (
        <article className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-3 text-display-lg text-on-surface">{value}</div>
        </article>
    );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
            <h3 className="text-headline-md text-on-surface">{title}</h3>
            <div className="mt-4 space-y-3">{children}</div>
        </section>
    );
}

function ListRow({ children }: { children: ReactNode }) {
    return (
        <div className="rounded border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant transition hover:bg-surface-container">
            {children}
        </div>
    );
}
