import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import type { ReactNode } from 'react';

type Props = {
    settings: {
        project_name: string;
        company_name: string;
        currency: string;
        exchange_rate_usd_crc: string;
        tax_label: string;
        tax_rate: string;
        document_prefix: string;
        gift_card_enabled: boolean;
        sync_conflict_owner: string;
        receipt_header: string;
        receipt_footer: string;
        auto_print_receipts: boolean;
    };
};

export default function SettingsIndex({ settings }: Props) {
    const { data, setData, post, processing } = useForm(settings);

    return (
        <AuthenticatedLayout
            header={(
                <div>
                    <p className="text-label-md text-on-surface-variant">Configuracion</p>
                    <h2 className="text-headline-lg text-on-surface">Negocio y documentos</h2>
                </div>
            )}
        >
            <Head title="Configuracion" />

            <div className="space-y-4">
                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Nombre del proyecto">
                            <Input value={data.project_name} onChange={(value) => setData('project_name', value)} />
                        </Field>
                        <Field label="Nombre comercial">
                            <Input value={data.company_name} onChange={(value) => setData('company_name', value)} />
                        </Field>
                        <Field label="Moneda">
                            <Input value={data.currency} onChange={(value) => setData('currency', value)} />
                        </Field>
                        <Field label="Tipo de cambio USD a CRC">
                            <Input value={data.exchange_rate_usd_crc} onChange={(value) => setData('exchange_rate_usd_crc', value)} />
                        </Field>
                        <Field label="Etiqueta impuesto">
                            <Input value={data.tax_label} onChange={(value) => setData('tax_label', value)} />
                        </Field>
                        <Field label="Tasa impuesto">
                            <Input value={data.tax_rate} onChange={(value) => setData('tax_rate', value)} />
                        </Field>
                        <Field label="Prefijo documentos">
                            <Input value={data.document_prefix} onChange={(value) => setData('document_prefix', value)} />
                        </Field>
                        <Field label="Responsable conflictos sync">
                            <Input value={data.sync_conflict_owner} onChange={(value) => setData('sync_conflict_owner', value)} />
                        </Field>
                        <Field label="Encabezado ticket">
                            <Input value={data.receipt_header} onChange={(value) => setData('receipt_header', value)} />
                        </Field>
                        <Field label="Pie ticket">
                            <Input value={data.receipt_footer} onChange={(value) => setData('receipt_footer', value)} />
                        </Field>
                    </div>

                    <label className="mt-4 flex items-center gap-3 text-body-sm text-on-surface">
                        <input type="checkbox" checked={data.gift_card_enabled} onChange={(e) => setData('gift_card_enabled', e.target.checked)} />
                        Habilitar gift cards
                    </label>
                    <label className="mt-3 flex items-center gap-3 text-body-sm text-on-surface">
                        <input
                            type="checkbox"
                            checked={data.auto_print_receipts}
                            onChange={(e) => setData('auto_print_receipts', e.target.checked)}
                        />
                        Imprimir tickets automaticamente si la impresora esta disponible
                    </label>

                    <button
                        type="button"
                        disabled={processing}
                        onClick={() => post(route('admin.settings.update'))}
                        className="mt-6 rounded bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary disabled:opacity-60"
                    >
                        Guardar configuracion
                    </button>
                    <button
                        type="button"
                        onClick={() => router.post(route('admin.settings.exchange-rate.sync'))}
                        className="ml-3 mt-6 rounded border border-outline-variant bg-white px-4 py-3 text-body-sm font-semibold text-on-surface"
                    >
                        Actualizar tipo de cambio
                    </button>
                </section>

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <h3 className="text-headline-md text-on-surface">Resumen operativo</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Info label="Moneda" value={settings.currency} />
                        <Info label="Tipo de cambio USD/CRC" value={settings.exchange_rate_usd_crc || 'Sin sincronizar'} />
                        <Info label="Impuesto" value={`${settings.tax_label} ${settings.tax_rate}%`} />
                        <Info label="Numeracion" value={settings.document_prefix} />
                        <Info label="Sync conflictos" value={settings.sync_conflict_owner} />
                        <Info label="Gift cards" value={settings.gift_card_enabled ? 'Activas' : 'Desactivadas'} />
                        <Info label="Tickets auto" value={settings.auto_print_receipts ? 'Activa' : 'Desactiva'} />
                        <Info label="Proyecto" value={settings.project_name} />
                    </div>
                </section>

                <section className="rounded-lg border border-outline-variant bg-surface p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-headline-md text-on-surface">Importacion de productos</h3>
                            <p className="text-body-sm text-on-surface-variant">
                                Carga tu export de WooCommerce con stock, precios y metadatos completos.
                            </p>
                        </div>
                        <Link
                            href={route('admin.products.import.index')}
                            className="rounded bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary"
                        >
                            Abrir importador
                        </Link>
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <label className="mb-2 block text-body-sm font-semibold text-on-surface">{label}</label>
            {children}
        </div>
    );
}

function Input({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <input
            className="w-full rounded border border-outline bg-surface px-4 py-3 text-body-sm text-on-surface"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded border border-outline-variant bg-surface-container-low p-4">
            <p className="text-label-md text-on-surface-variant">{label}</p>
            <div className="mt-2 text-body-lg font-semibold text-on-surface">{value}</div>
        </div>
    );
}
