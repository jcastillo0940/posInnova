import AppSidebar, { filterNavigationByPermissions } from '@/Components/AppSidebar';
import Dropdown from '@/Components/Dropdown';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useState } from 'react';

export default function Authenticated({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const { user, permissions } = usePage<PageProps>().props.auth;
    const navigation = filterNavigationByPermissions(permissions);
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);

    return (
        <div className="min-h-screen bg-background font-sans text-on-surface">
            <AppSidebar className="hidden lg:flex" />

            <div className="lg:pl-[260px]">
                <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface">
                    <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowingNavigationDropdown((previousState) => !previousState)}
                                className="inline-flex size-10 items-center justify-center rounded border border-outline bg-surface text-on-surface lg:hidden"
                                aria-label="Abrir menu"
                            >
                                <span className="material-symbols-outlined text-[22px]">
                                    {showingNavigationDropdown ? 'close' : 'menu'}
                                </span>
                            </button>

                            <div className="min-w-0">
                                <div className="truncate text-body-lg font-semibold text-on-surface">Panel global</div>
                                <div className="truncate text-label-md text-on-surface-variant">
                                    Navegacion y acciones compartidas
                                </div>
                            </div>
                        </div>

                        <div className="hidden items-center gap-6 xl:flex">
                            {navigation.map((item) => (
                                <Link
                                    key={item.route}
                                    href={route(item.route)}
                                    className={`border-b-2 px-1 py-5 text-body-sm font-semibold transition ${
                                        route().current(item.route)
                                            ? 'border-on-surface text-on-surface'
                                            : 'border-transparent text-on-surface hover:border-outline'
                                    }`}
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="hidden text-label-md text-on-surface-variant sm:inline">{user.email}</span>
                            <Dropdown>
                                <Dropdown.Trigger>
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 rounded-full border border-outline bg-surface-container-low px-3 py-2 text-body-sm font-semibold text-on-surface"
                                    >
                                        <span className="grid size-7 place-items-center rounded-full bg-primary text-on-primary">
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="hidden sm:inline">{user.name}</span>
                                        <span className="material-symbols-outlined text-[18px]">expand_more</span>
                                    </button>
                                </Dropdown.Trigger>
                                <Dropdown.Content>
                                    <Dropdown.Link href={route('profile.edit')}>Perfil</Dropdown.Link>
                                    <Dropdown.Link href={route('logout')} method="post" as="button">
                                        Salir
                                    </Dropdown.Link>
                                </Dropdown.Content>
                            </Dropdown>
                        </div>
                    </div>

                    <div className={`${showingNavigationDropdown ? 'block' : 'hidden'} border-t border-outline-variant bg-tertiary-container lg:hidden`}>
                        <div className="space-y-1 px-3 py-3">
                            {navigation.map((item) => (
                                <Link
                                    key={item.route}
                                    href={route(item.route)}
                                    className={`flex items-center gap-3 rounded px-3 py-3 text-body-md ${
                                        route().current(item.route)
                                            ? 'border border-on-surface bg-surface text-on-surface'
                                            : 'text-on-surface hover:bg-surface-container-low'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[20px] leading-none">{item.icon}</span>
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                </header>

                {header && (
                    <section className="border-b border-outline-variant bg-surface">
                        <div className="px-4 py-5 lg:px-6">{header}</div>
                    </section>
                )}

                <main className="px-4 py-6 lg:px-6">{children}</main>
            </div>
        </div>
    );
}
