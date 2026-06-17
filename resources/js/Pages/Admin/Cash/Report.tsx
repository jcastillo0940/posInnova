import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, Link, usePage } from '@inertiajs/react';

type Props = {
    mode: 'x' | 'z';
    session: {
        id: number;
        status: string;
        opened_at: string | null;
        closed_at: string | null;
        opening_float: number;
        expected_cash: number;
        counted_cash: number | null;
        cash_difference: number;
        sales_count: number;
        subtotal: number;
        discounts: number;
        tax: number;
        total: number;
        cash_sales: number;
        change_total: number;
        cash_register: string | null;
        branch: string | null;
        opened_by: string | null;
        closed_by: string | null;
        notes: string | null;
    };
};

export default function CashReport({ mode, session }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const money = (value: number | string) => formatMoney(value, moneySettings.currency || 'CRC');
    const title = mode === 'x' ? 'Reporte X' : 'Reporte Z';

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Caja</p>
                    <h2 className="text-headline-lg text-on-surface">{title}</h2>
                </div>
            )}
        >
            <Head title={title} />

            <div className="mx-auto max-w-5xl space-y-4">
                <div className="flex flex-wrap gap-3">
                    <Link
                        href={route(mode === 'x' ? 'admin.cash.x.pdf' : 'admin.cash.z.pdf', session.id)}
                        className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary"
                    >
                        Descargar PDF
                    </Link>
                    <Link href={route('admin.cash.index')} className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface">
                        Volver
                    </Link>
                </div>

                <div className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Metric label="Caja" value={`${session.cash_register ?? 'Caja'} | ${session.branch ?? 'Sucursal'}`} />
                        <Metric label="Estado" value={session.status} />
                        <Metric label="Apertura" value={session.opened_at ?? 'N/D'} />
                        <Metric label="Cierre" value={session.closed_at ?? 'N/D'} />
                        <Metric label="Ventas" value={session.sales_count} />
                        <Metric label="Total" value={money(session.total)} />
                        <Metric label="Esperado" value={money(session.expected_cash)} />
                        <Metric label="Diferencia" value={money(session.cash_difference)} />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function Metric({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded border border-outline-variant bg-surface-container-low p-4">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-2 text-body-lg font-semibold text-on-surface">{value}</div>
        </div>
    );
}
