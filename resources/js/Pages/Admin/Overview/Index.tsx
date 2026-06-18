import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, usePage } from '@inertiajs/react';

type Kpi = {
    count: number;
    revenue: number;
    discounts: number;
    profit: number;
    margin: number;
    avg_ticket: number;
};

type TopProduct = {
    name: string;
    qty: number;
    revenue: number;
    profit: number;
};

type RecentSale = {
    id: number;
    number: string;
    total: number;
    status: string;
    user: string | null;
    created_at: string;
};

type DayPoint = {
    day: string;
    total: number;
    count: number;
};

type InventoryStats = {
    total_active: number;
    low_stock: number;
    out_of_stock: number;
};

type Props = {
    kpis: { today: Kpi; month: Kpi; year: Kpi; prev_month: Kpi };
    topProducts: TopProduct[];
    recentSales: RecentSale[];
    dailySeries: DayPoint[];
    inventoryStats: InventoryStats;
    pendingApprovals: number;
};

export default function OverviewIndex({ kpis, topProducts, recentSales, dailySeries, inventoryStats, pendingApprovals }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const fmt = (v: number) => formatMoney(v, moneySettings.currency || 'CRC');

    const monthGrowth = kpis.prev_month.revenue > 0
        ? (((kpis.month.revenue - kpis.prev_month.revenue) / kpis.prev_month.revenue) * 100).toFixed(1)
        : null;

    const maxDayTotal = Math.max(...dailySeries.map((d) => d.total), 1);

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Administración</p>
                    <h2 className="text-headline-lg text-on-surface">Panel Ejecutivo</h2>
                </div>
            )}
        >
            <Head title="Panel Ejecutivo" />

            <div className="space-y-6">

                {/* KPI principal row */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <KpiCard
                        label="Ventas hoy"
                        value={fmt(kpis.today.revenue)}
                        sub={`${kpis.today.count} transacciones`}
                        accent="bg-secondary"
                        icon="today"
                    />
                    <KpiCard
                        label="Ventas del mes"
                        value={fmt(kpis.month.revenue)}
                        sub={monthGrowth !== null
                            ? `${Number(monthGrowth) >= 0 ? '+' : ''}${monthGrowth}% vs mes anterior`
                            : `${kpis.month.count} transacciones`}
                        accent="bg-primary"
                        icon="calendar_month"
                        highlight={monthGrowth !== null && Number(monthGrowth) >= 0}
                    />
                    <KpiCard
                        label="Ventas del año"
                        value={fmt(kpis.year.revenue)}
                        sub={`${kpis.year.count} transacciones`}
                        accent="bg-tertiary-container"
                        icon="bar_chart"
                        lightAccent
                    />
                    <KpiCard
                        label="Utilidad bruta mes"
                        value={fmt(kpis.month.profit)}
                        sub={`Margen ${kpis.month.margin}%`}
                        accent="bg-emerald-600"
                        icon="trending_up"
                    />
                </div>

                {/* Secondary row */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <KpiCard
                        label="Ticket promedio hoy"
                        value={fmt(kpis.today.avg_ticket)}
                        sub={`vs ${fmt(kpis.month.avg_ticket)} del mes`}
                        accent="bg-sky-600"
                        icon="receipt_long"
                    />
                    <KpiCard
                        label="Utilidad hoy"
                        value={fmt(kpis.today.profit)}
                        sub={`Margen ${kpis.today.margin}%`}
                        accent="bg-lime-600"
                        icon="savings"
                    />
                    <KpiCard
                        label="Productos activos"
                        value={String(inventoryStats.total_active)}
                        sub={inventoryStats.out_of_stock > 0
                            ? `${inventoryStats.out_of_stock} sin stock`
                            : 'Sin alertas de stock'}
                        accent={inventoryStats.out_of_stock > 0 ? 'bg-error' : 'bg-outline'}
                        icon="inventory_2"
                    />
                    <KpiCard
                        label="Aprobaciones pendientes"
                        value={String(pendingApprovals)}
                        sub={pendingApprovals > 0 ? 'Requieren atención' : 'Todo al día'}
                        accent={pendingApprovals > 0 ? 'bg-amber-500' : 'bg-outline'}
                        icon="approval"
                    />
                </div>

                {/* Sparkline + bottom grid */}
                <div className="grid gap-6 xl:grid-cols-[1fr_400px]">

                    {/* Left: Sparkline + top products */}
                    <div className="space-y-6">

                        {/* 14-day sparkline */}
                        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                            <h3 className="text-headline-md text-on-surface">Ventas últimos 14 días</h3>
                            <p className="mt-0.5 text-body-sm text-on-surface-variant">Ventas completadas por día</p>
                            <div className="mt-4 flex h-28 items-end gap-1">
                                {Array.from({ length: 14 }, (_, i) => {
                                    const date = new Date();
                                    date.setDate(date.getDate() - (13 - i));
                                    const dayStr = date.toISOString().slice(0, 10);
                                    const point = dailySeries.find((d) => d.day === dayStr);
                                    const height = point ? Math.max(8, (point.total / maxDayTotal) * 100) : 4;
                                    const isToday = i === 13;
                                    return (
                                        <div key={dayStr} className="group relative flex flex-1 flex-col items-center gap-1">
                                            <div
                                                className={`w-full rounded-t transition-all ${isToday ? 'bg-secondary' : 'bg-secondary/30 group-hover:bg-secondary/60'}`}
                                                style={{ height: `${height}%` }}
                                            />
                                            <span className="text-[9px] text-on-surface-variant">
                                                {date.getDate()}
                                            </span>
                                            {point && (
                                                <div className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-inverse-surface px-2 py-1 text-[10px] text-inverse-on-surface group-hover:block whitespace-nowrap">
                                                    {fmt(point.total)} ({point.count})
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Top products */}
                        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                            <h3 className="text-headline-md text-on-surface">Top productos del mes</h3>
                            <p className="mt-0.5 text-body-sm text-on-surface-variant">Ordenados por ingresos</p>
                            {topProducts.length === 0 ? (
                                <p className="mt-4 text-body-sm text-on-surface-variant">Sin ventas registradas este mes.</p>
                            ) : (
                                <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant">
                                    <table className="min-w-full divide-y divide-outline-variant text-body-sm">
                                        <thead className="bg-surface-container-low">
                                            <tr className="text-left text-label-md text-on-surface-variant">
                                                <th className="px-4 py-2">Producto</th>
                                                <th className="px-4 py-2 text-right">Cant.</th>
                                                <th className="px-4 py-2 text-right">Ingresos</th>
                                                <th className="px-4 py-2 text-right">Utilidad</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline-variant">
                                            {topProducts.map((product, i) => (
                                                <tr key={i} className="hover:bg-surface-container-low">
                                                    <td className="px-4 py-2 font-medium text-on-surface">{product.name}</td>
                                                    <td className="px-4 py-2 text-right text-on-surface-variant">{product.qty}</td>
                                                    <td className="px-4 py-2 text-right font-semibold text-on-surface">{fmt(product.revenue)}</td>
                                                    <td className={`px-4 py-2 text-right font-semibold ${product.profit >= 0 ? 'text-emerald-600' : 'text-error'}`}>
                                                        {fmt(product.profit)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Recent sales + inventory alerts */}
                    <div className="space-y-6">

                        {/* Inventory alerts */}
                        {(inventoryStats.low_stock > 0 || inventoryStats.out_of_stock > 0) && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-600">warning</span>
                                    <h3 className="text-headline-md text-amber-800">Alertas de inventario</h3>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {inventoryStats.out_of_stock > 0 && (
                                        <div className="flex items-center justify-between rounded-lg bg-red-100 px-4 py-2 text-body-sm">
                                            <span className="text-red-700">Sin stock</span>
                                            <span className="font-bold text-red-700">{inventoryStats.out_of_stock} productos</span>
                                        </div>
                                    )}
                                    {inventoryStats.low_stock > 0 && (
                                        <div className="flex items-center justify-between rounded-lg bg-amber-100 px-4 py-2 text-body-sm">
                                            <span className="text-amber-700">Stock bajo</span>
                                            <span className="font-bold text-amber-700">{inventoryStats.low_stock} productos</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Recent sales */}
                        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                            <h3 className="text-headline-md text-on-surface">Ventas recientes</h3>
                            <p className="mt-0.5 text-body-sm text-on-surface-variant">Últimas 10 transacciones</p>
                            <div className="mt-4 space-y-2">
                                {recentSales.length === 0 ? (
                                    <p className="text-body-sm text-on-surface-variant">Sin ventas registradas.</p>
                                ) : recentSales.map((sale) => (
                                    <div key={sale.id} className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-body-sm">
                                        <div className="min-w-0">
                                            <div className="font-semibold text-on-surface">{sale.number}</div>
                                            <div className="text-on-surface-variant">{sale.user ?? '—'} · {sale.created_at}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-on-surface">{fmt(sale.total)}</div>
                                            <StatusChip status={sale.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Month vs prev month comparison */}
                        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                            <h3 className="text-headline-md text-on-surface">Este mes vs anterior</h3>
                            <div className="mt-4 space-y-3">
                                <CompareRow label="Ingresos" current={kpis.month.revenue} prev={kpis.prev_month.revenue} fmt={fmt} />
                                <CompareRow label="Utilidad" current={kpis.month.profit} prev={kpis.prev_month.profit} fmt={fmt} />
                                <CompareRow label="Transacciones" current={kpis.month.count} prev={kpis.prev_month.count} fmt={(v) => String(Math.round(v))} />
                                <CompareRow label="Ticket promedio" current={kpis.month.avg_ticket} prev={kpis.prev_month.avg_ticket} fmt={fmt} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function KpiCard({ label, value, sub, accent, icon, highlight = false, lightAccent = false }: {
    label: string;
    value: string;
    sub: string;
    accent: string;
    icon: string;
    highlight?: boolean;
    lightAccent?: boolean;
}) {
    return (
        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <p className="text-label-md text-on-surface-variant">{label}</p>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${accent} text-white text-[16px] material-symbols-outlined ${lightAccent ? 'text-on-tertiary' : ''}`}>
                    {icon}
                </span>
            </div>
            <p className="mt-2 text-headline-lg font-bold text-on-surface">{value}</p>
            <p className={`mt-1 text-label-md ${highlight ? 'text-emerald-600' : 'text-on-surface-variant'}`}>{sub}</p>
        </div>
    );
}

function StatusChip({ status }: { status: string }) {
    const map: Record<string, string> = {
        completed: 'bg-emerald-100 text-emerald-700',
        pending_payment: 'bg-amber-100 text-amber-700',
        on_hold: 'bg-sky-100 text-sky-700',
        cancelled: 'bg-rose-100 text-rose-700',
        quote: 'bg-violet-100 text-violet-700',
    };
    const labels: Record<string, string> = {
        completed: 'Completada',
        pending_payment: 'Pendiente',
        on_hold: 'En espera',
        cancelled: 'Cancelada',
        quote: 'Cotización',
    };
    return (
        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? 'bg-surface-container text-on-surface-variant'}`}>
            {labels[status] ?? status}
        </span>
    );
}

function CompareRow({ label, current, prev, fmt }: { label: string; current: number; prev: number; fmt: (v: number) => string }) {
    const diff = prev > 0 ? (((current - prev) / prev) * 100) : 0;
    const up = current >= prev;
    return (
        <div className="flex items-center justify-between text-body-sm">
            <span className="text-on-surface-variant">{label}</span>
            <div className="flex items-center gap-2">
                <span className="font-semibold text-on-surface">{fmt(current)}</span>
                {prev > 0 && (
                    <span className={`flex items-center gap-0.5 text-label-md font-semibold ${up ? 'text-emerald-600' : 'text-error'}`}>
                        <span className="material-symbols-outlined text-[13px]">{up ? 'arrow_upward' : 'arrow_downward'}</span>
                        {Math.abs(diff).toFixed(1)}%
                    </span>
                )}
            </div>
        </div>
    );
}
