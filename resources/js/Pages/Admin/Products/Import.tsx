import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';

type Stats = {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
} | null;

type Props = {
    lastImport: Stats;
};

export default function Import({ lastImport }: Props) {
    const { flash } = usePage().props as { flash?: { status?: string } };
    const { data, setData, post, processing } = useForm<{ csv: File | null; dry_run: boolean }>({
        csv: null,
        dry_run: false,
    });

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Importacion</p>
                    <h2 className="text-headline-lg text-on-surface">Cargar productos desde WooCommerce</h2>
                </div>
            )}
        >
            <Head title="Importar productos" />

            <div className="space-y-4">
                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <p className="max-w-3xl text-body-sm text-on-surface-variant">
                        Sube el CSV exportado desde WooCommerce. El sistema importara nombre, SKU, precio, stock,
                        categorias, descripciones y metadatos completos. Las imagenes se ignoran por ahora.
                    </p>

                    <form
                        className="mt-6 grid gap-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            post(route('admin.products.import.store'), {
                                forceFormData: true,
                                preserveScroll: true,
                            });
                        }}
                    >
                        <label className="block">
                            <span className="mb-2 block text-body-sm font-semibold text-on-surface">Archivo CSV</span>
                            <input
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(e) => setData('csv', e.target.files?.[0] ?? null)}
                                className="block w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface file:mr-4 file:rounded file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-on-primary"
                            />
                        </label>

                        <label className="flex items-center gap-3 text-body-sm text-on-surface">
                            <input type="checkbox" checked={data.dry_run} onChange={(e) => setData('dry_run', e.target.checked)} />
                            Hacer prueba sin guardar
                        </label>

                        <button
                            type="submit"
                            disabled={processing || !data.csv}
                            className="w-fit rounded bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary disabled:opacity-60"
                        >
                            Importar ahora
                        </button>
                    </form>

                    {flash?.status && (
                        <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-4 text-body-sm text-emerald-800">
                            {flash.status}
                        </div>
                    )}
                </section>

                {lastImport && (
                    <section className="grid gap-4 md:grid-cols-4">
                        <Metric label="Procesados" value={lastImport.processed} />
                        <Metric label="Creados" value={lastImport.created} />
                        <Metric label="Actualizados" value={lastImport.updated} />
                        <Metric label="Omitidos" value={lastImport.skipped} />
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-2 text-display-lg text-on-surface">{value}</div>
        </div>
    );
}
