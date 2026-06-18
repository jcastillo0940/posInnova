import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

type UserRow = {
    id: number;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at?: string | null;
    updated_at?: string | null;
};

type Props = {
    users: UserRow[];
    roles: string[];
};

type CreateForm = {
    name: string;
    email: string;
    role: string;
    password: string;
};

export default function UsersIndex({ users, roles }: Props) {
    const [query, setQuery] = useState('');
    const createForm = useForm<CreateForm>({
        name: '',
        email: '',
        role: roles[0] ?? 'cashier',
        password: '',
    });

    const filteredUsers = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return users;

        return users.filter((user) => (
            user.name.toLowerCase().includes(term)
            || user.email.toLowerCase().includes(term)
            || user.role.toLowerCase().includes(term)
        ));
    }, [query, users]);

    const activeUsers = users.filter((user) => user.is_active).length;
    const inactiveUsers = users.length - activeUsers;
    const ownerCount = users.filter((user) => ['owner', 'super'].includes(user.role)).length;

    return (
        <AuthenticatedLayout
            header={(
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-label-md text-on-surface-variant">Usuarios</p>
                        <h2 className="text-headline-lg text-on-surface">Administracion de usuarios y roles</h2>
                    </div>
                    <div className="rounded-full border border-outline-variant bg-surface px-4 py-2 text-label-md text-on-surface-variant">
                        {filteredUsers.length} resultados
                    </div>
                </div>
            )}
        >
            <Head title="Usuarios" />

            <div className="space-y-6">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Usuarios totales" value={users.length} accent="from-sky-500 to-cyan-400" />
                    <StatCard label="Activos" value={activeUsers} accent="from-emerald-500 to-lime-400" />
                    <StatCard label="Inactivos" value={inactiveUsers} accent="from-amber-500 to-orange-400" />
                    <StatCard label="Superadmin" value={ownerCount} accent="from-violet-500 to-fuchsia-400" />
                </section>

                <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                        <h3 className="text-headline-md text-on-surface">Nuevo usuario</h3>
                        <p className="mt-1 text-body-sm text-on-surface-variant">
                            Crea cuentas operativas y asigna el rol desde el inicio.
                        </p>

                        <div className="mt-5 space-y-4">
                            <Field label="Nombre">
                                <Input value={createForm.data.name} onChange={(value) => createForm.setData('name', value)} />
                            </Field>
                            <Field label="Correo">
                                <Input value={createForm.data.email} onChange={(value) => createForm.setData('email', value)} type="email" />
                            </Field>
                            <Field label="Rol">
                                <Select value={createForm.data.role} onChange={(value) => createForm.setData('role', value)} options={roles} />
                            </Field>
                            <Field label="Contraseña (opcional — default: 1234)">
                                <Input value={createForm.data.password} onChange={(value) => createForm.setData('password', value)} type="password" />
                                {createForm.errors.password && (
                                    <p className="mt-1 text-label-md text-error">{createForm.errors.password}</p>
                                )}
                            </Field>

                            <button
                                type="button"
                                disabled={createForm.processing}
                                onClick={() => createForm.post(route('admin.users.store'), { preserveScroll: true, onSuccess: () => createForm.reset('name', 'email', 'password') })}
                                className="w-full rounded-xl bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary shadow-sm transition hover:opacity-95 disabled:opacity-60"
                            >
                                Crear usuario
                            </button>
                        </div>
                    </div>

                    <section className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h3 className="text-headline-md text-on-surface">Usuarios existentes</h3>
                                <p className="text-body-sm text-on-surface-variant">
                                    Edita datos, activa o desactiva cuentas y restablece credenciales.
                                </p>
                            </div>

                            <label className="w-full max-w-md">
                                <span className="mb-2 block text-label-md text-on-surface-variant">Buscar</span>
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Nombre, correo o rol"
                                    className="w-full rounded-full border border-outline bg-surface-container-low px-4 py-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
                                />
                            </label>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-2xl border border-outline-variant">
                            <table className="min-w-full divide-y divide-outline-variant">
                                <thead className="bg-surface-container-low">
                                    <tr className="text-left text-label-md text-on-surface-variant">
                                        <th className="px-4 py-3">Usuario</th>
                                        <th className="px-4 py-3">Rol</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant">
                                    {filteredUsers.map((user) => (
                                        <UserRow key={user.id} user={user} roles={roles} />
                                    ))}
                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-10 text-center text-body-sm text-on-surface-variant" colSpan={4}>
                                                No hay usuarios que coincidan con la busqueda.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function UserRow({ user, roles }: { user: UserRow; roles: string[] }) {
    const form = useForm({
        name: user.name,
        email: user.email,
        role: user.role,
    });

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const passwordForm = useForm({
        password: '',
        password_confirmation: '',
    });

    const submitPassword = () => {
        passwordForm.put(route('admin.users.set-password', user.id), {
            preserveScroll: true,
            onSuccess: () => {
                setShowPasswordForm(false);
                passwordForm.reset();
            },
        });
    };

    return (
        <>
            <tr className="align-top">
                <td className="px-4 py-4">
                    <div className="space-y-3">
                        <Input value={form.data.name} onChange={(value) => form.setData('name', value)} />
                        <Input value={form.data.email} onChange={(value) => form.setData('email', value)} type="email" />
                    </div>
                </td>
                <td className="px-4 py-4">
                    <Select value={form.data.role} onChange={(value) => form.setData('role', value)} options={roles} />
                </td>
                <td className="px-4 py-4">
                    <div className="space-y-2">
                        <StatusBadge active={user.is_active} />
                        <p className="text-label-md text-on-surface-variant">{user.updated_at ?? 'N/A'}</p>
                    </div>
                </td>
                <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={() => form.put(route('admin.users.update', user.id), { preserveScroll: true })}
                            className="rounded-xl bg-primary px-3 py-2 text-label-md font-semibold text-on-primary shadow-sm disabled:opacity-60"
                        >
                            Guardar
                        </button>
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={() => router.patch(route('admin.users.toggle', user.id), {}, { preserveScroll: true })}
                            className={`rounded-xl px-3 py-2 text-label-md font-semibold shadow-sm disabled:opacity-60 ${
                                user.is_active
                                    ? 'border border-amber-400 bg-amber-50 text-amber-700'
                                    : 'border border-emerald-400 bg-emerald-50 text-emerald-700'
                            }`}
                        >
                            {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowPasswordForm((v) => !v)}
                            className={`rounded-xl px-3 py-2 text-label-md font-semibold shadow-sm ${
                                showPasswordForm
                                    ? 'bg-secondary text-on-secondary'
                                    : 'border border-secondary text-secondary'
                            }`}
                        >
                            {showPasswordForm ? 'Cancelar' : 'Cambiar clave'}
                        </button>
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={() => {
                                if (!window.confirm(`Restablecer PIN de ${user.name} a 1234?`)) return;
                                router.post(route('admin.users.reset-pin', user.id), {}, { preserveScroll: true });
                            }}
                            className="rounded-xl border border-outline px-3 py-2 text-label-md font-semibold text-on-surface shadow-sm disabled:opacity-60"
                        >
                            Reset PIN
                        </button>
                    </div>
                </td>
            </tr>

            {showPasswordForm && (
                <tr className="bg-surface-container-low">
                    <td colSpan={4} className="px-4 pb-4 pt-2">
                        <div className="rounded-xl border border-secondary/30 bg-surface p-4">
                            <p className="mb-3 text-body-sm font-semibold text-on-surface">
                                Nueva contraseña para <span className="text-secondary">{user.name}</span>
                            </p>
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="block flex-1 min-w-[160px]">
                                    <span className="mb-1 block text-label-md text-on-surface-variant">Nueva contraseña</span>
                                    <Input
                                        value={passwordForm.data.password}
                                        onChange={(v) => passwordForm.setData('password', v)}
                                        type="password"
                                    />
                                    {passwordForm.errors.password && (
                                        <p className="mt-1 text-label-md text-error">{passwordForm.errors.password}</p>
                                    )}
                                </label>
                                <label className="block flex-1 min-w-[160px]">
                                    <span className="mb-1 block text-label-md text-on-surface-variant">Confirmar contraseña</span>
                                    <Input
                                        value={passwordForm.data.password_confirmation}
                                        onChange={(v) => passwordForm.setData('password_confirmation', v)}
                                        type="password"
                                    />
                                </label>
                                <button
                                    type="button"
                                    disabled={passwordForm.processing || !passwordForm.data.password}
                                    onClick={submitPassword}
                                    className="rounded-xl bg-secondary px-4 py-3 text-label-md font-semibold text-on-secondary shadow-sm disabled:opacity-60"
                                >
                                    {passwordForm.processing ? 'Guardando...' : 'Establecer contraseña'}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
            <div className={`mb-4 h-1.5 w-24 rounded-full bg-gradient-to-r ${accent}`} />
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-2 text-display-lg text-on-surface">{value}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="mb-2 block text-body-sm font-semibold text-on-surface">{label}</span>
            {children}
        </label>
    );
}

function Input({ value, onChange, type = 'text' }: { value: string; onChange: (value: string) => void; type?: string }) {
    return (
        <input
            type={type}
            className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
    return (
        <select
            className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface outline-none transition focus:border-primary"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {options.map((option) => (
                <option key={option} value={option}>
                    {option}
                </option>
            ))}
        </select>
    );
}

function StatusBadge({ active }: { active: boolean }) {
    return (
        <span
            className={`inline-flex rounded-full px-3 py-1 text-label-md font-semibold ${
                active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
        >
            {active ? 'Activo' : 'Inactivo'}
        </span>
    );
}
