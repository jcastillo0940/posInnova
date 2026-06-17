import AppSidebar from '@/Components/AppSidebar';
import { Head, Link } from '@inertiajs/react';

export default function Welcome({
    canLogin,
}: {
    canLogin: boolean;
}) {
    return (
        <div className="min-h-screen bg-background text-on-surface">
            <Head title="CorpERP" />

            <div className="flex min-h-screen">
                <AppSidebar className="hidden lg:flex" sessionActions={false} />

                <main className="flex flex-1 flex-col lg:ml-[260px]">
                    <header className="flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-4 lg:px-6">
                        <div>
                            <div className="text-body-lg font-bold text-on-surface lg:hidden">CorpERP</div>
                            <div className="hidden text-body-lg font-semibold text-on-surface lg:block">Panel operativo</div>
                        </div>

                        <nav className="flex items-center gap-3">
                            {canLogin && (
                                <Link href={route('login')} className="rounded border border-outline px-4 py-2 text-body-sm font-semibold text-on-surface">
                                    Entrar
                                </Link>
                            )}
                        </nav>
                    </header>

                    <section className="grid flex-1 place-items-center px-4 py-10">
                        <div className="max-w-3xl">
                            <p className="text-label-md text-on-surface-variant">CorpERP POS</p>
                            <h1 className="mt-3 text-display-lg text-on-surface">
                                Punto de venta, inventario y caja en una sola operacion.
                            </h1>
                            <p className="mt-4 max-w-2xl text-body-lg text-on-surface-variant">
                                Gestiona ventas, productos importados desde WooCommerce, existencias actuales,
                                arqueos y reportes con una interfaz clara para trabajo diario.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">
                                {canLogin && (
                                    <Link href={route('login')} className="rounded bg-primary px-5 py-3 text-body-sm font-semibold text-on-primary">
                                        Ir al sistema
                                    </Link>
                                )}
                            </div>

                            <div className="mt-10 grid gap-3 md:grid-cols-3">
                                <Info title="Ventas" body="Flujo POS rapido con carrito, pagos y stock conectado." />
                                <Info title="Inventario" body="Conteo, kardex y cantidades actuales importadas." />
                                <Info title="Caja" body="Apertura, cierre, reportes X/Z y tickets compactos." />
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

function Info({ title, body }: { title: string; body: string }) {
    return (
        <article className="rounded-lg border border-outline-variant bg-surface p-4 shadow-sm">
            <h2 className="text-headline-md text-on-surface">{title}</h2>
            <p className="mt-2 text-body-sm text-on-surface-variant">{body}</p>
        </article>
    );
}
