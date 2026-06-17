import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { formatMoney } from '@/lib/money';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Session = {
    id: number;
    status: string;
    opening_float: string;
    current_cash: string;
    counted_cash: string | null;
    cash_difference: string | null;
    opened_at: string | null;
    closed_at: string | null;
    cash_register: string | null;
    branch: string | null;
    opened_by: string | null;
    opened_by_user: string | null;
    closed_by: string | null;
    closed_responsible_user: string | null;
};

type Report = {
    expected_cash: number;
    counted_cash: number | null;
    cash_difference: number;
    sales_count: number;
    total: number;
    change_total: number;
    opening_float: number;
    cash_register: string | null;
    branch: string | null;
    opened_by: string | null;
    opened_by_user: string | null;
    closed_by: string | null;
    closed_responsible_user: string | null;
    opened_at: string | null;
    closed_at: string | null;
    notes: string | null;
    denominations: Array<{ denomination: number; count: number; amount: number }>;
};

type CashRegister = {
    id: number;
    name: string;
    branch: string | null;
};

type ResponsibleUser = {
    id: number;
    name: string;
    role: string;
};

type Props = {
    openSession: Session | null;
    closedSessions: Session[];
    xReport: Report | null;
    canCloseCash: boolean;
    cashRegisters: CashRegister[];
    responsibleUsers: ResponsibleUser[];
};

const denominationOptions = [50000, 20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];
const storageKeys = {
    helpDismissed: 'cash-module-help-dismissed',
    openUserId: 'cash-module-last-open-user-id',
    closeUserId: 'cash-module-last-close-user-id',
    denominationIndex: 'cash-module-last-denomination-index',
};

export default function CashIndex({ openSession, closedSessions, xReport, canCloseCash, cashRegisters, responsibleUsers }: Props) {
    const { money: moneySettings } = usePage<PageProps>().props;
    const money = (value: number | string | null | undefined) => formatMoney(value ?? 0, moneySettings.currency || 'CRC');
    const storedOpenUserId = getStoredNumber(storageKeys.openUserId);
    const storedCloseUserId = getStoredNumber(storageKeys.closeUserId);
    const storedDenominationIndex = getStoredNumber(storageKeys.denominationIndex);

    const initialOpenUser = responsibleUsers.find((user) => user.id === storedOpenUserId) ?? responsibleUsers[0] ?? null;
    const initialCloseUser = responsibleUsers.find((user) => user.id === storedCloseUserId)
        ?? initialOpenUser
        ?? responsibleUsers[0]
        ?? null;

    const closeForm = useForm({
        counted_cash: xReport ? xReport.expected_cash.toFixed(2) : '',
        notes: '',
        closed_responsible_user_id: initialCloseUser?.id ?? '',
        denominations: denominationOptions.map((denomination) => ({ denomination, count: 0 })),
    });

    const openForm = useForm({
        cash_register_id: cashRegisters[0]?.id ?? '',
        opening_float: '100.00',
        opened_by_user_id: initialOpenUser?.id ?? '',
    });

    const notesRef = useRef<HTMLTextAreaElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const [showHelpOverlay, setShowHelpOverlay] = useState(false);
    const [selectedDenominationIndex, setSelectedDenominationIndex] = useState(
        storedDenominationIndex === null ? 0 : Math.max(0, Math.min(denominationOptions.length - 1, storedDenominationIndex)),
    );
    const [selectedResponsibleIndex, setSelectedResponsibleIndex] = useState(() => {
        const storedId = storedCloseUserId ?? storedOpenUserId;
        const storedIndex = responsibleUsers.findIndex((user) => user.id === storedId);
        return storedIndex >= 0 ? storedIndex : 0;
    });

    const updateTotal = (next: Array<{ denomination: number; count: number }>) => {
        const total = next.reduce((sum, item) => sum + Number(item.denomination) * Number(item.count), 0);
        closeForm.setData('denominations', next);
        closeForm.setData('counted_cash', total.toFixed(2));
    };

    const bumpDenomination = (index: number, delta: number) => {
        const next = [...closeForm.data.denominations];
        const count = Math.max(0, Number(next[index].count) + delta);
        next[index] = { ...next[index], count };
        updateTotal(next);
    };

    const cycleResponsible = (delta: number) => {
        const list = responsibleUsers;
        if (!list.length) return;

        const currentIndex = openSession
            ? Math.max(0, list.findIndex((user) => user.id === Number(closeForm.data.closed_responsible_user_id || list[0].id)))
            : Math.max(0, list.findIndex((user) => user.id === Number(openForm.data.opened_by_user_id || list[0].id)));
        const nextIndex = (currentIndex + delta + list.length) % list.length;
        setSelectedResponsibleIndex(nextIndex);

        if (openSession) {
            closeForm.setData('closed_responsible_user_id', list[nextIndex].id);
        } else {
            openForm.setData('opened_by_user_id', list[nextIndex].id);
        }
    };

    const openPrintWindow = (url: string) => {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.src = url;
        iframe.onload = () => {
            setTimeout(() => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                } finally {
                    setTimeout(() => iframe.remove(), 1000);
                }
            }, 200);
        };
        document.body.appendChild(iframe);
    };

    const dismissHelpOverlay = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(storageKeys.helpDismissed, '1');
        }
        setShowHelpOverlay(false);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setShowHelpOverlay(window.localStorage.getItem(storageKeys.helpDismissed) !== '1');
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !openForm.data.opened_by_user_id) return;
        window.localStorage.setItem(storageKeys.openUserId, String(openForm.data.opened_by_user_id));
    }, [openForm.data.opened_by_user_id]);

    useEffect(() => {
        if (typeof window === 'undefined' || !closeForm.data.closed_responsible_user_id) return;
        window.localStorage.setItem(storageKeys.closeUserId, String(closeForm.data.closed_responsible_user_id));
    }, [closeForm.data.closed_responsible_user_id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(storageKeys.denominationIndex, String(selectedDenominationIndex));
    }, [selectedDenominationIndex]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!openSession || !canCloseCash) return;

            const key = event.key.toLowerCase();
            const shortcuts: Record<string, number> = {
                '1': 0,
                '2': 1,
                '3': 2,
                '4': 3,
                '5': 4,
                '6': 5,
                '7': 6,
                '8': 7,
                '9': 8,
            };

            if (event.ctrlKey && key === 'enter') {
                event.preventDefault();
                closeForm.post(route('admin.cash.close', openSession.id), { preserveScroll: true });
                return;
            }

            if (key === '+' || key === '=') {
                event.preventDefault();
                bumpDenomination(selectedDenominationIndex, 1);
                return;
            }

            if (key === '-') {
                event.preventDefault();
                bumpDenomination(selectedDenominationIndex, -1);
                return;
            }

            if (event.altKey && key in shortcuts) {
                event.preventDefault();
                bumpDenomination(shortcuts[key], 1);
                return;
            }

            if (event.altKey && key === 'p') {
                event.preventDefault();
                openPrintWindow(route('admin.cash.ticket', openSession.id));
                return;
            }

            if (event.altKey && key === 'n') {
                event.preventDefault();
                notesRef.current?.focus();
                return;
            }

            if (event.altKey && key === 'c') {
                event.preventDefault();
                closeButtonRef.current?.focus();
                return;
            }

            if (event.altKey && key === 'arrowright') {
                event.preventDefault();
                cycleResponsible(1);
                return;
            }

            if (event.altKey && key === 'arrowleft') {
                event.preventDefault();
                cycleResponsible(-1);
                return;
            }

            if (event.altKey && key === 'arrowup') {
                event.preventDefault();
                setSelectedDenominationIndex((current) => Math.max(0, current - 1));
                return;
            }

            if (event.altKey && key === 'arrowdown') {
                event.preventDefault();
                setSelectedDenominationIndex((current) => Math.min(denominationOptions.length - 1, current + 1));
                return;
            }

            if (key === 'enter' && event.altKey === false && event.ctrlKey === false) {
                if (document.activeElement?.tagName === 'BODY') {
                    event.preventDefault();
                    bumpDenomination(selectedDenominationIndex, 1);
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [openSession, canCloseCash, closeForm, selectedDenominationIndex, responsibleUsers, openForm, openSession, openForm.data.opened_by_user_id, closeForm.data.closed_responsible_user_id]);

    const countedFromDenominations = closeForm.data.denominations
        .reduce((sum, row) => sum + Number(row.denomination) * Number(row.count), 0)
        .toFixed(2);

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Administracion</p>
                    <h2 className="text-headline-lg text-on-surface">Caja y arqueo</h2>
                </div>
            )}
        >
            <Head title="Caja y arqueo" />

            <div className="space-y-4">
                {showHelpOverlay && (
                    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-2xl rounded-lg border border-outline-variant bg-surface p-4 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-label-md text-on-surface-variant">Atajos de caja</p>
                                <h3 className="mt-1 text-headline-md text-on-surface">Arranque rapido del arqueo</h3>
                                <p className="mt-2 text-body-sm text-on-surface-variant">
                                    Usa `+ / -` para ajustar la denominacion activa, `Alt+1..9` para sumar rapido, `Alt+Flechas` para mover selecciones, `Ctrl+Enter` para cerrar y `Alt+P` para imprimir.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={dismissHelpOverlay}
                                className="rounded border border-outline px-3 py-1 text-body-sm font-semibold text-on-surface hover:bg-surface-container-low"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                )}

                {!openSession && canCloseCash && (
                    <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-headline-md text-on-surface">Apertura formal de caja</h3>
                                <p className="text-body-sm text-on-surface-variant">Selecciona caja, responsable y fondo inicial para iniciar el turno.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => openForm.post(route('admin.cash.open'), { preserveScroll: true })}
                                className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary"
                            >
                                Abrir caja
                            </button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                            <Field label="Caja">
                                <select
                                    className="w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface"
                                    value={openForm.data.cash_register_id}
                                    onChange={(e) => openForm.setData('cash_register_id', Number(e.target.value))}
                                >
                                    {cashRegisters.map((register) => (
                                        <option key={register.id} value={register.id}>
                                            {register.name} {register.branch ? `· ${register.branch}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Responsable">
                                <select
                                    className="w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface"
                                    value={openForm.data.opened_by_user_id}
                                    onChange={(e) => openForm.setData('opened_by_user_id', Number(e.target.value))}
                                >
                                    {responsibleUsers.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} ({user.role})
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Fondo inicial">
                                <input
                                    className="w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface"
                                    value={openForm.data.opening_float}
                                    onChange={(e) => openForm.setData('opening_float', e.target.value)}
                                />
                            </Field>
                        </div>
                    </section>
                )}

                {openSession ? (
                    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <article className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-body-sm text-on-surface-variant">Sesion abierta</p>
                                    <h3 className="text-headline-md text-on-surface">
                                        {openSession.cash_register ?? 'Caja'} · {openSession.branch ?? 'Sucursal'}
                                    </h3>
                                </div>
                                <div className="rounded bg-emerald-50 px-3 py-1 text-body-sm font-semibold text-emerald-800">
                                    {openSession.status}
                                </div>
                            </div>

                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <Info label="Abierta por" value={openSession.opened_by_user ?? openSession.opened_by ?? 'N/D'} />
                                <Info label="Apertura" value={openSession.opened_at ?? 'N/D'} />
                                <Info label="Efectivo actual" value={money(openSession.current_cash)} />
                                <Info label="Fondo inicial" value={money(openSession.opening_float)} />
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link href={route('admin.cash.x', openSession.id)} className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface hover:bg-surface-container-low">
                                    Ver X
                                </Link>
                                <Link href={route('admin.cash.z', openSession.id)} className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface hover:bg-surface-container-low">
                                    Preparar Z
                                </Link>
                                <Link href={route('admin.cash.x.pdf', openSession.id)} className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface hover:bg-surface-container-low">
                                    PDF X
                                </Link>
                            </div>
                        </article>

                        <article className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                            <h3 className="text-headline-md text-on-surface">Arqueo y cierre</h3>
                            {canCloseCash ? (
                                <div className="mt-4 space-y-4">
                                    <div className="rounded border border-outline-variant bg-surface-container-low p-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-on-surface">Conteo por denominaciones</h4>
                                            <span className="text-body-sm text-on-surface-variant">Total: {money(countedFromDenominations)}</span>
                                        </div>
                                        <p className="mt-2 text-label-md text-on-surface-variant">
                                            Atajos: + / - ajustan cantidad, Alt+1..9 suma por denominacion, Alt+Flechas mueve responsable/seleccion, Enter suma la denominacion activa, Ctrl+Enter cierra, Alt+P imprime.
                                        </p>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {denominationOptions.map((denomination, index) => (
                                                <button
                                                    key={denomination}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedDenominationIndex(index);
                                                        bumpDenomination(index, 1);
                                                    }}
                                                    className={`rounded border px-3 py-1 text-label-md font-semibold hover:bg-surface ${index === selectedDenominationIndex ? 'border-on-surface bg-surface text-on-surface' : 'border-outline text-on-surface-variant'}`}
                                                >
                                                    +{denomination}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {responsibleUsers.map((user, index) => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedResponsibleIndex(index);
                                                        closeForm.setData('closed_responsible_user_id', user.id);
                                                    }}
                                                    className={`rounded border px-3 py-1 text-label-md font-semibold hover:bg-surface ${index === selectedResponsibleIndex ? 'border-on-surface bg-surface text-on-surface' : 'border-outline text-on-surface-variant'}`}
                                                >
                                                    {user.name}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            {closeForm.data.denominations.map((row, index) => (
                                                <div key={row.denomination} className="rounded border border-outline-variant bg-surface p-3">
                                                    <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
                                                        <span>{money(row.denomination)}</span>
                                                        <span>{Number(row.count)} unidades</span>
                                                    </div>
                                                    <div className="mt-3 flex items-center gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => bumpDenomination(index, -1)}
                                                            className="rounded border border-outline px-3 py-1 text-on-surface"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="200"
                                                            value={row.count}
                                                            onChange={(e) => {
                                                                const next = [...closeForm.data.denominations];
                                                                next[index] = { ...row, count: Number(e.target.value) };
                                                                updateTotal(next);
                                                            }}
                                                            className="w-full"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => bumpDenomination(index, 1)}
                                                            className="rounded border border-outline px-3 py-1 text-on-surface"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-body-sm font-semibold text-on-surface">Responsable de cierre</label>
                                        <select
                                            className="w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface"
                                            value={closeForm.data.closed_responsible_user_id}
                                            onChange={(e) => {
                                                const nextValue = Number(e.target.value);
                                                closeForm.setData('closed_responsible_user_id', nextValue);
                                                setSelectedResponsibleIndex(Math.max(0, responsibleUsers.findIndex((user) => user.id === nextValue)));
                                            }}
                                        >
                                            {responsibleUsers.map((user) => (
                                                <option key={user.id} value={user.id}>
                                                    {user.name} ({user.role})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-body-sm font-semibold text-on-surface">Efectivo contado</label>
                                        <input
                                            className="w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface"
                                            value={closeForm.data.counted_cash}
                                            onChange={(e) => closeForm.setData('counted_cash', e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-body-sm font-semibold text-on-surface">Notas</label>
                                        <textarea
                                            ref={notesRef}
                                            className="min-h-32 w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface"
                                            value={closeForm.data.notes}
                                            onChange={(e) => closeForm.setData('notes', e.target.value)}
                                        />
                                    </div>

                                    <button
                                        ref={closeButtonRef}
                                        type="button"
                                        disabled={closeForm.processing}
                                        onClick={() => closeForm.post(route('admin.cash.close', openSession.id), {
                                            preserveScroll: true,
                                            onSuccess: () => {
                                                openPrintWindow(route('admin.cash.ticket', openSession.id));
                                            },
                                        })}
                                        className="w-full rounded bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary disabled:opacity-60"
                                    >
                                        Cerrar caja
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-4 text-body-sm text-on-surface-variant">Solo un perfil autorizado puede cerrar caja.</p>
                            )}
                        </article>
                    </section>
                ) : (
                    <section className="rounded-lg border border-outline-variant bg-surface p-5 text-body-sm text-on-surface-variant shadow-sm">
                        No hay sesion abierta en este momento.
                    </section>
                )}

                {xReport && (
                    <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                        <h3 className="text-headline-md text-on-surface">Resumen X</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                            <Info label="Ventas" value={xReport.sales_count} />
                            <Info label="Total" value={money(xReport.total)} />
                            <Info label="Esperado" value={money(xReport.expected_cash)} />
                            <Info label="Contado" value={xReport.counted_cash !== null ? money(xReport.counted_cash) : 'Pendiente'} />
                            <Info label="Diferencia" value={money(xReport.cash_difference)} />
                            <Info label="Cambio" value={money(xReport.change_total)} />
                        </div>
                    </section>
                )}

                {openSession && (
                    <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-headline-md text-on-surface">Resumen de cierre imprimible</h3>
                                <p className="text-body-sm text-on-surface-variant">Lista para usar como cash drawer al cerrar la sesion.</p>
                            </div>
                            <div className="flex gap-3">
                                <Link href={route('admin.cash.z.pdf', openSession.id)} className="rounded bg-primary px-4 py-2 text-body-sm font-semibold text-on-primary">
                                    Imprimir cierre
                                </Link>
                                <Link href={route('admin.cash.ticket', openSession.id)} className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface">
                                    Ticket compacto
                                </Link>
                            </div>
                        </div>
                    </section>
                )}

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Cierres recientes</h3>
                    <div className="mt-4 space-y-3">
                        {closedSessions.length ? closedSessions.map((session) => (
                            <div key={session.id} className="rounded border border-outline-variant bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-on-surface">
                                        {session.cash_register ?? 'Caja'} · {session.branch ?? 'Sucursal'}
                                    </span>
                                    <span>{session.closed_at ?? 'sin fecha'}</span>
                                </div>
                                <p className="mt-1">
                                    Contado: {money(session.counted_cash)} · Diferencia: {money(session.cash_difference)}
                                </p>
                            </div>
                        )) : (
                            <p className="text-body-sm text-on-surface-variant">Todavia no hay cierres registrados.</p>
                        )}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function getStoredNumber(key: string) {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(key);
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <label className="mb-2 block text-body-sm font-semibold text-on-surface">{label}</label>
            {children}
        </div>
    );
}

function Info({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded border border-outline-variant bg-surface-container-low p-4">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-2 text-body-lg font-semibold text-on-surface">{value}</div>
        </div>
    );
}
