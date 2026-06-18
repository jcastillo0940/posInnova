import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatMoney } from '@/lib/money';
import { PageProps } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';

type RequestRow = {
    id: number;
    type: string;
    status: string;
    requested_amount: number;
    approved_amount: number | null;
    credit_limit: number | null;
    current_credit: number | null;
    pending_credit: number | null;
    max_discount: number | null;
    requested_discount: number | null;
    reason: string | null;
    decision_notes: string | null;
    created_at: string | null;
    decided_at: string | null;
    sale: { id: number; number: string; total: number; status: string; customer: string | null } | null;
    customer: { id: number; name: string; document: string | null } | null;
    requester: string | null;
    decider: string | null;
};

type Props = {
    requests: RequestRow[];
};

export default function ApprovalsIndex({ requests }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const currency = moneySettings.currency || 'CRC';
    const money = (value: number | string) => formatMoney(value, currency);
    const decisionForm = useForm<{ decision_notes: string; approved_amount: string }>({
        decision_notes: '',
        approved_amount: '',
    });
    const rejectForm = useForm<{ decision_notes: string }>({
        decision_notes: '',
    });

    const creditRequests = requests.filter((request) => request.type === 'credit_overlimit');
    const discountRequests = requests.filter((request) => request.type === 'discount_override');
    const manualRequests = requests.filter((request) => request.type !== 'credit_overlimit' && request.type !== 'discount_override');

    const labelForType = (type: string) => {
        if (type === 'credit_overlimit') return 'Solicitud de credito';
        if (type === 'discount_override') return 'Solicitud de descuento';
        return 'Revision manual';
    };

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!requests.some((request) => request.status === 'pending')) {
                return;
            }

            router.reload({ only: ['requests'] });
        }, 15000);

        return () => window.clearInterval(timer);
    }, [requests]);

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-1">
                    <p className="text-label-md text-on-surface-variant">Administracion</p>
                    <h2 className="text-headline-lg text-on-surface">Aprobaciones remotas</h2>
                    <p className="text-body-sm text-on-surface-variant">
                        Revisa ventas detenidas por credito o descuento y apruebalas desde el telefono.
                    </p>
                </div>
            )}
        >
            <Head title="Aprobaciones" />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
                <section className="space-y-4">
                    <ApprovalSection
                        title="Aprobaciones de credito"
                        description="Ventas que exceden el limite del cliente."
                        requests={creditRequests}
                        money={money}
                        decisionForm={decisionForm}
                        rejectForm={rejectForm}
                        labelForType={labelForType}
                    />

                    <ApprovalSection
                        title="Aprobaciones de descuento"
                        description="Ventas con descuentos por encima del maximo permitido."
                        requests={discountRequests}
                        money={money}
                        decisionForm={decisionForm}
                        rejectForm={rejectForm}
                        labelForType={labelForType}
                    />

                    <ApprovalSection
                        title="Revisiones manuales"
                        description="Casos especiales que requieren validacion adicional."
                        requests={manualRequests}
                        money={money}
                        decisionForm={decisionForm}
                        rejectForm={rejectForm}
                        labelForType={labelForType}
                    />
                </section>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                        <h3 className="text-headline-md text-on-surface">Como funciona</h3>
                        <ul className="mt-4 space-y-3 text-body-sm text-on-surface-variant">
                            <li>1. El cajero deja la venta en espera cuando supera un limite o un descuento.</li>
                            <li>2. El gerente abre esta pantalla desde el telefono y revisa el caso.</li>
                            <li>3. Aprueba o rechaza sin tocar el POS del cajero.</li>
                            <li>4. Si aprueba, la venta se libera con el mismo detalle que fue enviado.</li>
                        </ul>
                    </div>

                    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 text-body-sm text-on-surface-variant">
                        <p className="font-semibold text-on-surface">Claves rapidas</p>
                        <p className="mt-2">Credito: muestra limite, saldo actual y exceso.</p>
                        <p className="mt-1">Descuento: muestra el descuento pedido y el tope permitido.</p>
                        <p className="mt-1">Todo queda trazado en auditoria.</p>
                    </div>
                </aside>
            </div>
        </AuthenticatedLayout>
    );
}

function ApprovalSection({
    title,
    description,
    requests,
    money,
    decisionForm,
    rejectForm,
    labelForType,
}: {
    title: string;
    description: string;
    requests: RequestRow[];
    money: (value: number | string) => string;
    decisionForm: ReturnType<typeof useForm<{ decision_notes: string; approved_amount: string }>>;
    rejectForm: ReturnType<typeof useForm<{ decision_notes: string }>>;
    labelForType: (type: string) => string;
}) {
    return (
        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-headline-md text-on-surface">{title}</h3>
                    <p className="text-body-sm text-on-surface-variant">{description}</p>
                </div>
                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {requests.length} solicitudes
                </span>
            </div>

            <div className="mt-4 space-y-4">
                {requests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-outline-variant bg-surface p-8 text-center text-body-md text-on-surface-variant">
                        No hay solicitudes en esta seccion.
                    </div>
                ) : (
                    requests.map((request) => {
                        const isPending = request.status === 'pending';
                        const kind = labelForType(request.type);
                        const isCreditRequest = request.type === 'credit_overlimit';
                        const isDiscountRequest = request.type === 'discount_override';
                        const approvedCredit = isCreditRequest
                            ? (request.approved_amount ?? request.credit_limit)
                            : null;
                        const approvedDiscount = isDiscountRequest && request.approved_amount !== null ? request.approved_amount : null;
                        const finalCreditBalance = isCreditRequest && approvedCredit !== null
                            ? Math.max(0, request.requested_amount - approvedCredit)
                            : null;
                        const finalTotal = isDiscountRequest && approvedDiscount !== null
                            ? Math.max(0, request.requested_amount - approvedDiscount)
                            : null;
                        const approvalLabel = isCreditRequest ? 'Credito autorizado' : isDiscountRequest ? 'Descuento autorizado' : 'Monto aprobado';

                        return (
                            <article key={request.id} className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                                                {kind}
                                            </span>
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                                                    request.status === 'pending'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : request.status === 'approved'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                }`}
                                            >
                                                {request.status}
                                            </span>
                                        </div>
                                        <h4 className="mt-3 text-headline-md text-on-surface">
                                            {request.sale?.number ?? 'Venta pendiente'}
                                        </h4>
                                        <p className="text-body-sm text-on-surface-variant">
                                            {request.customer?.name ?? 'Sin cliente'} · {request.created_at ?? 'sin fecha'}
                                        </p>
                                    </div>

                                    <div className="min-w-[160px] rounded-2xl bg-primary-container px-4 py-3 text-right">
                                        <p className="text-label-md text-on-primary-container">
                                            {isCreditRequest ? 'Exceso a revisar' : isDiscountRequest ? 'Descuento pedido' : 'Monto solicitado'}
                                        </p>
                                        <p className="text-headline-sm font-bold text-on-primary-container">
                                            {isCreditRequest && request.pending_credit !== null
                                                ? money(request.pending_credit)
                                                : isDiscountRequest && request.requested_discount !== null
                                                    ? money(request.requested_discount)
                                                    : money(request.requested_amount)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <Stat label="Venta" value={request.sale?.status ?? 'pendiente'} />
                                    <Stat label="Cliente" value={request.customer?.document ?? 'Sin cedula'} />
                                    <Stat label="Solicitado por" value={request.requester ?? 'Sistema'} />
                                    <Stat label="Decidido por" value={request.decider ?? 'Pendiente'} />
                                </div>

                                {isCreditRequest ? (
                                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                                        <Stat label="Credito pedido" value={money(request.requested_amount)} />
                                        <Stat label="Credito autorizado" value={approvedCredit !== null ? money(approvedCredit) : 'Pendiente'} />
                                        <Stat label="Saldo final" value={finalCreditBalance !== null ? money(finalCreditBalance) : 'Pendiente'} />
                                    </div>
                                ) : isDiscountRequest ? (
                                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                                        <Stat label="Descuento pedido" value={request.requested_discount !== null ? money(request.requested_discount) : 'N/D'} />
                                        <Stat label="Descuento autorizado" value={approvedDiscount !== null ? money(approvedDiscount) : 'Pendiente'} />
                                        <Stat label="Total final a cobrar" value={finalTotal !== null ? money(finalTotal) : 'Pendiente'} />
                                    </div>
                                ) : (
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <Stat label="Monto solicitado" value={money(request.requested_amount)} />
                                        <Stat label="Referencia" value={request.sale?.number ?? 'Sin venta'} />
                                    </div>
                                )}

                                {request.reason && (
                                    <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                                        {request.reason}
                                    </div>
                                )}

                                {request.decision_notes && (
                                    <div className="mt-3 rounded-2xl border border-outline-variant bg-surface-container-high p-4 text-body-sm text-on-surface">
                                        <span className="font-semibold">Notas:</span> {request.decision_notes}
                                    </div>
                                )}

                                {isPending && (
                                    <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end">
                                        <label className="flex-1">
                                            <span className="mb-2 block text-label-md text-on-surface-variant">Notas de decision</span>
                                            <textarea
                                                className="min-h-24 w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
                                                placeholder="Escribe por que se aprueba o rechaza esta venta"
                                                value={decisionForm.data.decision_notes}
                                                onChange={(e) => decisionForm.setData('decision_notes', e.target.value)}
                                            />
                                        </label>

                                        <label className="w-full lg:max-w-[220px]">
                                            <span className="mb-2 block text-label-md text-on-surface-variant">{approvalLabel}</span>
                                            <input
                                                className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
                                                placeholder={isCreditRequest && request.pending_credit !== null
                                                    ? money(request.pending_credit)
                                                    : isDiscountRequest && request.requested_discount !== null
                                                        ? money(request.requested_discount)
                                                        : money(request.requested_amount)}
                                                value={decisionForm.data.approved_amount}
                                                onChange={(e) => decisionForm.setData('approved_amount', e.target.value)}
                                            />
                                        </label>

                                        <div className="flex flex-col gap-3 sm:flex-row lg:w-auto">
                                            <button
                                                type="button"
                                                className="rounded-xl bg-primary px-5 py-3 text-body-sm font-semibold text-on-primary shadow-sm transition hover:opacity-95"
                                                onClick={() => router.post(route('admin.approvals.approve', request.id), decisionForm.data, { preserveScroll: true })}
                                            >
                                                Aprobar
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-xl border border-error bg-white px-5 py-3 text-body-sm font-semibold text-error transition hover:bg-error/5"
                                                onClick={() => router.post(route('admin.approvals.reject', request.id), rejectForm.data, { preserveScroll: true })}
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
            <p className="mt-2 text-body-md font-semibold text-on-surface">{value}</p>
        </div>
    );
}
