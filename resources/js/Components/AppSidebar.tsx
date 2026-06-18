import { Link } from '@inertiajs/react';
import { router, usePage } from '@inertiajs/react';
import { AuthPermissions, PageProps } from '@/types';
import { useEffect, useRef, useState } from 'react';

type PermissionKey = keyof AuthPermissions;

export const appNavigation = [
    { name: 'Nueva Venta', route: 'dashboard', icon: 'point_of_sale', permission: 'accessPos' },
    { name: 'Transacciones', route: 'admin.reports.index', icon: 'history', permission: 'accessReports' },
    { name: 'Aprobaciones', route: 'admin.approvals.index', icon: 'approval', permission: 'accessReports' },
    { name: 'Productos', route: 'admin.inventory.products', icon: 'inventory_2', permission: 'accessProducts' },
    { name: 'Operaciones', route: 'admin.operations.index', icon: 'group', permission: 'accessCustomers' },
    { name: 'Corte de Caja', route: 'admin.cash.index', icon: 'analytics', permission: 'accessCash' },
    { name: 'Importaciones', route: 'admin.imports.index', icon: 'database_upload', permission: 'manageUsers' },
    { name: 'Usuarios', route: 'admin.users.index', icon: 'manage_accounts', permission: 'manageUsers' },
] satisfies Array<{
    name: string;
    route: string;
    icon: string;
    permission: PermissionKey;
}>;

export type AppNavigationItem = (typeof appNavigation)[number];

export function filterNavigationByPermissions(permissions: AuthPermissions): AppNavigationItem[] {
    return appNavigation.filter((item) => permissions[item.permission]);
}

type AppSidebarProps = {
    className?: string;
    sessionActions?: boolean;
};

export default function AppSidebar({ className = '', sessionActions = true }: AppSidebarProps) {
    const page = usePage<PageProps>().props as PageProps & { approvals?: { pendingCount?: number } };
    const { permissions } = page.auth;
    const pendingApprovals = page.approvals?.pendingCount ?? 0;
    const navigation = filterNavigationByPermissions(permissions);
    const previousCount = useRef(pendingApprovals);
    const [highlight, setHighlight] = useState(false);

    useEffect(() => {
        if (pendingApprovals > previousCount.current) {
            setHighlight(true);
            const timer = window.setTimeout(() => setHighlight(false), 5000);
            previousCount.current = pendingApprovals;
            return () => window.clearTimeout(timer);
        }

        previousCount.current = pendingApprovals;
    }, [pendingApprovals]);

    useEffect(() => {
        if (!(permissions.accessReports || permissions.useSupervisorPin)) return;

        const timer = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            router.reload({ only: ['approvals'] });
        }, 15000);

        return () => window.clearInterval(timer);
    }, [permissions.accessReports, permissions.useSupervisorPin]);

    return (
        <aside className={`fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col border-r border-outline-variant bg-tertiary-container ${className}`}>
            <div className="p-lg">
                <h1 className="font-headline-lg text-headline-lg font-bold text-on-tertiary">CorpERP</h1>
                <p className="mt-1 font-body-sm text-on-tertiary-container">Terminal de Punto de Venta</p>
            </div>

            <nav className="flex-1 py-4">
                    {navigation.map((item) => (
                        <Link
                            key={item.route}
                            className={`flex items-center gap-3 px-4 py-3 font-body-md text-body-md transition-colors ${
                            route().current(item.route)
                                ? 'border-l-4 border-secondary bg-on-tertiary-container text-on-tertiary'
                                : 'text-on-tertiary-container hover:bg-on-tertiary-container/50'
                        }`}
                        href={route(item.route)}
                    >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span>{item.name}</span>
                        </Link>
                    ))}
                </nav>

            {sessionActions ? (
                <div className="mt-auto border-t border-on-tertiary/10 p-md">
                    {permissions.useSupervisorPin && (
                        <Link
                            href={route('supervisor.pin.form')}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 font-label-md text-on-secondary transition-opacity hover:opacity-90"
                        >
                            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                            Supervisor
                        </Link>
                    )}
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="mt-4 flex w-full items-center gap-3 rounded px-4 py-3 text-left text-on-tertiary-container transition-colors hover:bg-on-tertiary-container/50"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="font-body-md">Cerrar Sesion</span>
                    </Link>
                </div>
            ) : (
                <div className="mt-auto border-t border-on-tertiary/10 p-md">
                    <Link
                        href={route('login')}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 font-label-md text-on-secondary transition-opacity hover:opacity-90"
                    >
                        <span className="material-symbols-outlined text-[18px]">login</span>
                        Entrar
                    </Link>
                </div>
            )}
            {pendingApprovals > 0 && (
                <div className="border-t border-on-tertiary/10 px-4 py-3">
                    <Link
                        href={route('admin.approvals.index')}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-white shadow-sm transition-transform duration-300 ${
                            highlight ? 'animate-pulse bg-error scale-[1.03]' : 'bg-error/90 hover:bg-error'
                        }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">approval</span>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold">Aprobaciones pendientes</div>
                            <div className="text-xs text-white/90">{pendingApprovals} ventas esperando respuesta</div>
                        </div>
                    </Link>
                </div>
            )}
        </aside>
    );
}
