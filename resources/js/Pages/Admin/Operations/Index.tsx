import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Modal from '@/Components/Modal';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Props = {
    creditAccounts: Array<{ id: number; credit_limit: string; balance: string; status: string; customer?: { name: string } | null }>;
    layaways: Array<{ id: number; number: string; deposit: string; balance: string; status: string; customer?: { name: string } | null }>;
    returns: Array<{ id: number; number: string; amount: string; status: string; sale?: { id: number; number: string } | null }>;
};

type PaymentTarget =
    | { kind: 'credit'; id: number; label: string }
    | { kind: 'layaway'; id: number; label: string };

type ReturnTarget =
    | { kind: 'handle'; id: number; label: string; saleId: number | null }
    | { kind: 'void'; id: number; label: string; saleId: number | null };

export default function Index({ creditAccounts, layaways, returns }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const money = (value: number | string) => formatMoney(value, moneySettings.currency || 'CRC');
    const paymentForm = useForm({ amount: '' });
    const returnForm = useForm({ reason: '' });
    const [query, setQuery] = useState('');
    const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
    const [returnTarget, setReturnTarget] = useState<ReturnTarget | null>(null);

    const normalizedQuery = query.trim().toLowerCase();

    const filteredCreditAccounts = useMemo(() => creditAccounts.filter((item) => {
        if (!normalizedQuery) return true;
        return [item.customer?.name, item.status, item.balance, item.credit_limit]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    }), [creditAccounts, normalizedQuery]);

    const filteredLayaways = useMemo(() => layaways.filter((item) => {
        if (!normalizedQuery) return true;
        return [item.number, item.customer?.name, item.status, item.deposit, item.balance]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    }), [layaways, normalizedQuery]);

    const filteredReturns = useMemo(() => returns.filter((item) => {
        if (!normalizedQuery) return true;
        return [item.number, item.sale?.number, item.status, item.amount]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    }), [returns, normalizedQuery]);

    const closePaymentModal = () => {
        setPaymentTarget(null);
        paymentForm.reset('amount');
    };

    const closeReturnModal = () => {
        setReturnTarget(null);
        returnForm.reset('reason');
    };

    return (
        <AuthenticatedLayout
            header={(
                <div className="space-y-2">
                    <p className="text-label-md text-on-surface-variant">Administracion</p>
                    <h2 className="text-headline-lg text-on-surface">Credito, apartados y devoluciones</h2>
                    <p className="text-body-sm text-on-surface-variant">
                        Busca rapido, selecciona la fila correcta y ejecuta la accion desde un modal.
                    </p>
                </div>
            )}
        >
            <Head title="Operaciones" />

            <div className="mb-4 rounded-2xl border border-outline-variant bg-surface p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <label className="block text-body-sm font-semibold text-on-surface">Buscar</label>
                        <p className="mt-1 text-xs text-on-surface-variant">Filtra por cliente, numero, estado o monto.</p>
                    </div>
                    <div className="text-xs text-on-surface-variant">
                        {normalizedQuery ? `Mostrando resultados para "${query}"` : 'Mostrando todos los registros visibles.'}
                    </div>
                </div>
                <div className="mt-3 flex gap-2">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
                            search
                        </span>
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Cliente, numero, estado o monto"
                            className="w-full rounded-xl border border-outline bg-surface-container-low py-3 pl-10 pr-3 text-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                        />
                    </div>
                    {normalizedQuery ? (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="rounded-xl border border-outline-variant bg-white px-4 py-3 text-body-sm font-semibold text-on-surface"
                        >
                            Limpiar
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="space-y-4">
                <Panel title="Cuentas de credito" rows={filteredCreditAccounts.map((item) => `${item.customer?.name ?? 'Cliente'} | limite ${money(item.credit_limit)} | saldo ${money(item.balance)} | ${item.status}`)}>
                    <div className="mt-4 grid gap-3">
                        {filteredCreditAccounts.length ? filteredCreditAccounts.map((item) => (
                            <div key={item.id} className="rounded border border-outline-variant bg-surface-container-low px-4 py-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="font-semibold text-on-surface">{item.customer?.name ?? 'Cliente'}</div>
                                        <div className="text-body-sm text-on-surface-variant">
                                            Limite {money(item.credit_limit)} · Saldo {money(item.balance)} · {item.status}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentTarget({
                                            kind: 'credit',
                                            id: item.id,
                                            label: item.customer?.name ?? 'Cliente',
                                        })}
                                        className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary"
                                    >
                                        Pagar
                                    </button>
                                </div>
                            </div>
                        )) : <div className="text-body-sm text-on-surface-variant">Sin cuentas de credito aun.</div>}
                    </div>
                </Panel>

                <Panel title="Apartados" rows={filteredLayaways.map((item) => `${item.number} | ${item.customer?.name ?? 'Cliente'} | abono ${money(item.deposit)} | saldo ${money(item.balance)} | ${item.status}`)}>
                    <div className="mt-4 grid gap-3">
                        {filteredLayaways.length ? filteredLayaways.map((item) => (
                            <div key={item.id} className="rounded border border-outline-variant bg-surface-container-low px-4 py-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="font-semibold text-on-surface">Apartado {item.number}</div>
                                        <div className="text-body-sm text-on-surface-variant">
                                            {item.customer?.name ?? 'Cliente'} · Abono {money(item.deposit)} · Saldo {money(item.balance)} · {item.status}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentTarget({
                                            kind: 'layaway',
                                            id: item.id,
                                            label: `Apartado ${item.number}`,
                                        })}
                                        className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary"
                                    >
                                        Pagar
                                    </button>
                                </div>
                            </div>
                        )) : <div className="text-body-sm text-on-surface-variant">Sin apartados aun.</div>}
                    </div>
                </Panel>

                <Panel title="Devoluciones" rows={filteredReturns.map((item) => `${item.number} | venta ${item.sale?.number ?? '-'} | monto ${money(item.amount)} | ${item.status}`)}>
                    <div className="mt-4 grid gap-3">
                        {filteredReturns.length ? filteredReturns.map((item) => (
                            <div key={item.id} className="rounded border border-outline-variant bg-surface-container-low px-4 py-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="font-semibold text-on-surface">{item.number}</div>
                                        <div className="text-body-sm text-on-surface-variant">
                                            Venta {item.sale?.number ?? '-'} · Monto {money(item.amount)} · {item.status}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setReturnTarget({
                                                kind: 'handle',
                                                id: item.id,
                                                label: item.number,
                                                saleId: item.sale?.id ?? null,
                                            })}
                                            className="rounded border border-outline-variant bg-white px-3 py-2 text-body-sm font-semibold text-on-surface"
                                        >
                                            Marcar atendida
                                        </button>
                                        {item.sale?.id ? (
                                            <button
                                                type="button"
                                                onClick={() => setReturnTarget({
                                                    kind: 'void',
                                                    id: item.id,
                                                    label: item.number,
                                                    saleId: item.sale?.id ?? null,
                                                })}
                                                className="rounded bg-error px-3 py-2 text-body-sm font-semibold text-white"
                                            >
                                                Anular venta
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        )) : <div className="text-body-sm text-on-surface-variant">Sin devoluciones aun.</div>}
                    </div>
                </Panel>
            </div>

            <Modal show={paymentTarget !== null} onClose={closePaymentModal} maxWidth="lg">
                <div className="p-6 sm:p-8">
                    <h3 className="text-headline-md text-on-surface">
                        {paymentTarget?.kind === 'credit' ? 'Aplicar abono a credito' : 'Aplicar pago a apartado'}
                    </h3>
                    <p className="mt-2 text-body-sm text-on-surface-variant">
                        {paymentTarget?.label ?? ''}
                    </p>

                    <form
                        className="mt-5 space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!paymentTarget) return;

                            const routeName = paymentTarget.kind === 'credit'
                                ? 'admin.operations.credit-accounts.payment'
                                : 'admin.operations.layaways.payment';

                            router.post(route(routeName, paymentTarget.id), {
                                amount: paymentForm.data.amount,
                            }, {
                                preserveScroll: true,
                                onSuccess: closePaymentModal,
                            });
                        }}
                    >
                        <input
                            autoFocus
                            className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                            placeholder="Monto"
                            value={paymentForm.data.amount}
                            onChange={(event) => paymentForm.setData('amount', event.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={closePaymentModal} className="rounded border border-outline-variant bg-white px-4 py-2 text-body-sm font-semibold text-on-surface">
                                Cancelar
                            </button>
                            <button type="submit" className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary">
                                Confirmar
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            <Modal show={returnTarget !== null} onClose={closeReturnModal} maxWidth="lg">
                <div className="p-6 sm:p-8">
                    <h3 className="text-headline-md text-on-surface">
                        {returnTarget?.kind === 'void' ? 'Anular venta' : 'Marcar devolucion atendida'}
                    </h3>
                    <p className="mt-2 text-body-sm text-on-surface-variant">
                        {returnTarget?.label ?? ''}
                    </p>

                    <form
                        className="mt-5 space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!returnTarget) return;

                            if (returnTarget.kind === 'handle') {
                                router.post(route('admin.operations.returns.handle', returnTarget.id), {}, {
                                    preserveScroll: true,
                                    onSuccess: closeReturnModal,
                                });
                                return;
                            }

                            if (!returnTarget.saleId) return;

                            router.post(route('admin.sales.void', returnTarget.saleId), {
                                reason: returnForm.data.reason || 'Devolucion registrada en operaciones',
                            }, {
                                preserveScroll: true,
                                onSuccess: closeReturnModal,
                            });
                        }}
                    >
                        {returnTarget?.kind === 'void' ? (
                            <textarea
                                autoFocus
                            className="min-h-28 w-full rounded-xl border border-outline bg-surface px-3 py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
                            placeholder="Motivo de anulacion"
                            value={returnForm.data.reason}
                            onChange={(event) => returnForm.setData('reason', event.target.value)}
                        />
                        ) : (
                            <div className="rounded border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
                                Esta accion solo registrara la devolucion como atendida.
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={closeReturnModal} className="rounded border border-outline-variant bg-white px-4 py-2 text-body-sm font-semibold text-on-surface">
                                Cancelar
                            </button>
                            <button type="submit" className={`rounded px-4 py-2 text-body-sm font-semibold text-white ${returnTarget?.kind === 'void' ? 'bg-error' : 'bg-primary'}`}>
                                Confirmar
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

function Panel({ title, rows, children }: { title: string; rows: string[]; children?: ReactNode }) {
    return (
        <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
            <h3 className="text-headline-md text-on-surface">{title}</h3>
            <div className="mt-4 space-y-2 text-body-sm text-on-surface-variant">
                {rows.length ? rows.map((row, index) => (
                    <div key={index} className="rounded border border-outline-variant bg-surface-container-low px-4 py-3 transition hover:bg-surface-container">
                        {row}
                    </div>
                )) : <div className="text-on-surface-variant">Sin registros aun.</div>}
            </div>
            {children}
        </section>
    );
}
