import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

type Stats = {
    orders?: number;
    line_items?: number;
    sales_created?: number;
    items_created?: number;
    processed?: number;
    created?: number;
    updated?: number;
    skipped?: number;
    counts?: Record<string, number>;
    sample_orders?: Array<{ order: string; status: string; mapped_status: string; lines: number; total: number }>;
    sample_products?: Array<{ name: string; barcode: string; category?: string | null; price: number; stock: number }>;
} | null;

type Props = {
    productImport: Stats;
    productXmlImport: Stats;
    historicalImport: Stats;
};

export default function DataImportsIndex({ productImport, productXmlImport, historicalImport }: Props) {
    const { flash } = usePage().props as { flash?: { status?: string } };
    const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'historical' | 'backup'>('overview');

    const productsForm = useForm<{ csv: File | null; dry_run: boolean }>({
        csv: null,
        dry_run: true,
    });

    const historicalForm = useForm<{ csv: File | null; dry_run: boolean }>({
        csv: null,
        dry_run: true,
    });

    const productXmlForm = useForm<{ xml: File | null; dry_run: boolean }>({
        xml: null,
        dry_run: true,
    });

    const warnings = useMemo(() => {
        const items: string[] = [];

        if ((historicalImport?.counts?.other ?? 0) > 0) {
            items.push(`Hay ${(historicalImport?.counts?.other ?? 0)} pedidos con estados no mapeados del histórico.`);
        }

        if ((historicalImport?.counts?.pending_payment ?? 0) > 0) {
            items.push(`Hay ${(historicalImport?.counts?.pending_payment ?? 0)} pedidos pendientes de pago.`);
        }

        if ((historicalImport?.counts?.on_hold ?? 0) > 0) {
            items.push(`Hay ${(historicalImport?.counts?.on_hold ?? 0)} pedidos en espera o procesando.`);
        }

        items.push('Antes de importar en real, descarga un respaldo y corre siempre la vista previa.');
        items.push('La importacion historica crea ventas y lineas; no reduce stock porque el inventario ya representa el estado actual.');

        return items;
    }, [historicalImport]);

    return (
        <AuthenticatedLayout
            header={(
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-label-md text-on-surface-variant">Superadmin</p>
                        <h2 className="text-headline-lg text-on-surface">Importaciones y historico</h2>
                    </div>
                    <div className="rounded-full border border-outline-variant bg-surface px-4 py-2 text-label-md text-on-surface-variant">
                        {activeTab === 'overview' ? 'Resumen general' : activeTab}
                    </div>
                </div>
            )}
        >
            <Head title="Importaciones" />

            <div className="space-y-6">
                {flash?.status && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-body-sm text-emerald-800">
                        {flash.status}
                    </div>
                )}

                <section className="flex flex-wrap gap-2 rounded-2xl border border-outline-variant bg-surface p-2 shadow-sm">
                    <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Resumen</TabButton>
                    <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')}>Productos</TabButton>
                    <TabButton active={activeTab === 'historical'} onClick={() => setActiveTab('historical')}>Pedidos historicos</TabButton>
                    <TabButton active={activeTab === 'backup'} onClick={() => setActiveTab('backup')}>Respaldo</TabButton>
                </section>

                {activeTab === 'overview' && (
                    <section className="space-y-6">
                        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Metric label="Productos creados" value={productImport?.created ?? 0} />
                            <Metric label="Productos actualizados" value={productImport?.updated ?? 0} />
                            <Metric label="Productos XML" value={productXmlImport?.processed ?? 0} />
                            <Metric label="Pedidos historicos" value={historicalImport?.orders ?? 0} />
                        </section>

                        <section className="grid gap-6 xl:grid-cols-2">
                            <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                                <h3 className="text-headline-md text-on-surface">Advertencias antes de importar</h3>
                                <div className="mt-4 space-y-3">
                                    {warnings.map((warning) => (
                                        <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-body-sm text-amber-900">
                                            {warning}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                                <h3 className="text-headline-md text-on-surface">Estados historicos detectados</h3>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <StatusStat label="Completados" value={historicalImport?.counts?.completed ?? 0} tone="emerald" />
                                    <StatusStat label="En espera" value={historicalImport?.counts?.on_hold ?? 0} tone="amber" />
                                    <StatusStat label="Pendiente pago" value={historicalImport?.counts?.pending_payment ?? 0} tone="blue" />
                                    <StatusStat label="Cancelados" value={historicalImport?.counts?.cancelled ?? 0} tone="rose" />
                                    <StatusStat label="Reembolsados" value={historicalImport?.counts?.refunded ?? 0} tone="violet" />
                                    <StatusStat label="Otros" value={historicalImport?.counts?.other ?? 0} tone="slate" />
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                            <h3 className="text-headline-md text-on-surface">Muestras detectadas</h3>
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {(historicalImport?.sample_orders ?? []).map((sample) => (
                                    <div key={sample.order} className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-on-surface">{sample.order}</p>
                                                <p className="text-label-md text-on-surface-variant">{sample.status || 'Sin estado'}</p>
                                            </div>
                                            <span className="rounded-full bg-surface px-2 py-1 text-label-md text-on-surface">{sample.mapped_status}</span>
                                        </div>
                                        <div className="mt-3 text-body-sm text-on-surface-variant">
                                            Lineas: {sample.lines} · Total: {sample.total}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </section>
                )}

                {activeTab === 'products' && (
                    <section className="grid gap-6 xl:grid-cols-2">
                        <ImportCard
                            title="Importar productos por CSV"
                            description="Usa el export plano de WooCommerce para catalogo, stock y precios."
                            form={productsForm}
                            action={() => productsForm.post(route('admin.imports.products'), { forceFormData: true, preserveScroll: true })}
                            buttonLabel={productsForm.data.dry_run ? 'Previsualizar CSV' : 'Importar CSV'}
                        >
                            <ProductSampleList stats={productImport} title="Resultado CSV" emptyLabel="Sin vista previa CSV todavia." />
                        </ImportCard>

                        <XmlImportCard
                            title="Importar productos por XML"
                            description="Usa el export WordPress/WooCommerce para conservar mas metadatos del producto."
                            form={productXmlForm}
                            action={() => productXmlForm.post(route('admin.imports.products-xml'), { forceFormData: true, preserveScroll: true })}
                            buttonLabel={productXmlForm.data.dry_run ? 'Previsualizar XML' : 'Importar XML'}
                        >
                            <ProductSampleList stats={productXmlImport} title="Resultado XML" emptyLabel="Sin vista previa XML todavia." />
                        </XmlImportCard>
                    </section>
                )}

                {activeTab === 'historical' && (
                    <ImportCard
                        title="Importar pedidos historicos"
                        description="Sube el CSV de pedidos para sembrar ventas historicas con cliente mostrador."
                        form={historicalForm}
                        action={() => historicalForm.post(route('admin.imports.historical-orders'), { forceFormData: true, preserveScroll: true })}
                        buttonLabel={historicalForm.data.dry_run ? 'Previsualizar pedidos' : 'Importar pedidos'}
                    >
                        <SampleList stats={historicalImport} title="Vista previa historica" emptyLabel="Sin vista previa del historico todavia." />
                    </ImportCard>
                )}

                {activeTab === 'backup' && (
                    <section className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
                        <h3 className="text-headline-md text-on-surface">Respaldo previo</h3>
                        <p className="mt-1 text-body-sm text-on-surface-variant">
                            Descarga una copia JSON de referencia con productos y ventas antes de importar.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link
                                href={route('admin.imports.backup')}
                                className="rounded-xl bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary shadow-sm"
                            >
                                Descargar respaldo
                            </Link>
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-body-sm text-amber-900">
                                Recomendado antes de ejecutar importaciones reales.
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl px-4 py-2 text-body-sm font-semibold transition ${
                active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
        >
            {children}
        </button>
    );
}

function ImportCard({
    title,
    description,
    form,
    action,
    children,
    buttonLabel,
}: {
    title: string;
    description: string;
    form: ReturnType<typeof useForm<{ csv: File | null; dry_run: boolean }>>;
    action: () => void;
    children: ReactNode;
    buttonLabel: string;
}) {
    const danger = !form.data.dry_run;

    return (
        <section className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h3 className="text-headline-md text-on-surface">{title}</h3>
                    <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>
                </div>
                {danger && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-label-md text-rose-800">
                        Ejecutara cambios reales
                    </div>
                )}
            </div>

            <div className="mt-5 space-y-4">
                <label className="block">
                    <span className="mb-2 block text-label-md font-semibold text-on-surface">Archivo CSV</span>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => form.setData('csv', e.target.files?.[0] ?? null)}
                        className="block w-full rounded-xl border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-on-primary"
                    />
                </label>

                <label className="flex items-center gap-3 text-body-sm text-on-surface">
                    <input
                        type="checkbox"
                        checked={form.data.dry_run}
                        onChange={(e) => form.setData('dry_run', e.target.checked)}
                    />
                    Vista previa sin guardar
                </label>

                {danger && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-body-sm text-amber-900">
                        Antes de continuar, descarga un respaldo y confirma que la vista previa coincide con lo esperado.
                    </div>
                )}

                <button
                    type="button"
                    disabled={form.processing || !form.data.csv}
                    onClick={action}
                    className={`rounded-xl px-4 py-3 text-body-sm font-semibold shadow-sm disabled:opacity-60 ${
                        danger ? 'bg-rose-600 text-white' : 'bg-primary text-on-primary'
                    }`}
                >
                    {buttonLabel}
                </button>
            </div>

            <div className="mt-5">{children}</div>
        </section>
    );
}

function XmlImportCard({
    title,
    description,
    form,
    action,
    children,
    buttonLabel,
}: {
    title: string;
    description: string;
    form: ReturnType<typeof useForm<{ xml: File | null; dry_run: boolean }>>;
    action: () => void;
    children: ReactNode;
    buttonLabel: string;
}) {
    const danger = !form.data.dry_run;

    return (
        <section className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h3 className="text-headline-md text-on-surface">{title}</h3>
                    <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>
                </div>
                {danger && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-label-md text-rose-800">
                        Ejecutara cambios reales
                    </div>
                )}
            </div>

            <div className="mt-5 space-y-4">
                <label className="block">
                    <span className="mb-2 block text-label-md font-semibold text-on-surface">Archivo XML</span>
                    <input
                        type="file"
                        accept=".xml,text/xml,application/xml"
                        onChange={(e) => form.setData('xml', e.target.files?.[0] ?? null)}
                        className="block w-full rounded-xl border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-on-primary"
                    />
                </label>

                <label className="flex items-center gap-3 text-body-sm text-on-surface">
                    <input
                        type="checkbox"
                        checked={form.data.dry_run}
                        onChange={(e) => form.setData('dry_run', e.target.checked)}
                    />
                    Vista previa sin guardar
                </label>

                {danger && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-body-sm text-amber-900">
                        Antes de continuar, descarga un respaldo y confirma que la vista previa coincide con lo esperado.
                    </div>
                )}

                <button
                    type="button"
                    disabled={form.processing || !form.data.xml}
                    onClick={action}
                    className={`rounded-xl px-4 py-3 text-body-sm font-semibold shadow-sm disabled:opacity-60 ${
                        danger ? 'bg-rose-600 text-white' : 'bg-primary text-on-primary'
                    }`}
                >
                    {buttonLabel}
                </button>
            </div>

            <div className="mt-5">{children}</div>
        </section>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-2 text-display-lg text-on-surface">{value}</div>
        </div>
    );
}

function StatusStat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'blue' | 'rose' | 'violet' | 'slate' }) {
    const tones = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        blue: 'bg-sky-50 text-sky-700 border-sky-200',
        rose: 'bg-rose-50 text-rose-700 border-rose-200',
        violet: 'bg-violet-50 text-violet-700 border-violet-200',
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
    } as const;

    return (
        <div className={`rounded-xl border p-4 ${tones[tone]}`}>
            <p className="text-label-md">{label}</p>
            <div className="mt-1 text-display-sm">{value}</div>
        </div>
    );
}

function SampleList({ stats, title, emptyLabel }: { stats: Stats; title: string; emptyLabel: string }) {
    const samples = stats?.sample_orders ?? [];

    if (!samples.length) {
        return <p className="text-body-sm text-on-surface-variant">{emptyLabel}</p>;
    }

    return (
        <div className="space-y-3">
            <p className="text-label-md font-semibold text-on-surface">{title}</p>
            {samples.map((sample) => (
                <div key={sample.order} className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{sample.order}</strong>
                        <span className="rounded-full bg-surface px-2 py-1 text-label-md">{sample.mapped_status}</span>
                    </div>
                    <div className="mt-1 text-on-surface-variant">
                        Estado: {sample.status || 'Sin estado'} · Lineas: {sample.lines} · Total: {sample.total}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProductSampleList({ stats, title, emptyLabel }: { stats: Stats; title: string; emptyLabel: string }) {
    const samples = stats?.sample_products ?? [];

    if (!samples.length) {
        return (
            <div className="space-y-2">
                <p className="text-label-md font-semibold text-on-surface">{title}</p>
                <p className="text-body-sm text-on-surface-variant">{emptyLabel}</p>
                {stats && (
                    <div className="grid gap-2 sm:grid-cols-2">
                        <MiniMetric label="Procesados" value={stats.processed ?? 0} />
                        <MiniMetric label="Creados" value={stats.created ?? 0} />
                        <MiniMetric label="Actualizados" value={stats.updated ?? 0} />
                        <MiniMetric label="Omitidos" value={stats.skipped ?? 0} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-label-md font-semibold text-on-surface">{title}</p>
            <div className="grid gap-2 sm:grid-cols-2">
                <MiniMetric label="Procesados" value={stats?.processed ?? 0} />
                <MiniMetric label="Creados" value={stats?.created ?? 0} />
                <MiniMetric label="Actualizados" value={stats?.updated ?? 0} />
                <MiniMetric label="Omitidos" value={stats?.skipped ?? 0} />
            </div>
            {samples.map((sample) => (
                <div key={`${sample.barcode}-${sample.name}`} className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{sample.name}</strong>
                        <span className="rounded-full bg-surface px-2 py-1 text-label-md">{sample.barcode}</span>
                    </div>
                    <div className="mt-1 text-on-surface-variant">
                        Categoria: {sample.category || 'Sin categoria'} · Precio: {sample.price} · Stock: {sample.stock}
                    </div>
                </div>
            ))}
        </div>
    );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-1 text-headline-sm text-on-surface">{value}</div>
        </div>
    );
}
