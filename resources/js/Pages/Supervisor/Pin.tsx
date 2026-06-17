import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, useForm } from '@inertiajs/react';

export default function SupervisorPin() {
    const { data, setData, post, processing, errors } = useForm({
        pin: '',
    });

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <p className="text-label-md text-on-surface-variant">Seguridad</p>
                    <h2 className="text-headline-lg text-on-surface">PIN de supervisor</h2>
                </div>
            }
        >
            <Head title="PIN de supervisor" />

            <div className="mx-auto max-w-xl py-6">
                <div className="rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
                    <div className="mb-5 flex items-start gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded bg-surface-container-low text-on-surface">
                            <span className="material-symbols-outlined text-[24px]">lock</span>
                        </div>
                        <p className="text-body-sm text-on-surface-variant">
                            Ingresa el PIN para habilitar acciones sensibles durante los proximos 30 minutos.
                        </p>
                    </div>

                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            post(route('supervisor.pin.store'));
                        }}
                    >
                        <div>
                            <InputLabel htmlFor="pin" value="PIN" className="text-on-surface" />
                            <TextInput
                                id="pin"
                                type="password"
                                className="mt-1 block w-full rounded border-outline bg-surface text-on-surface"
                                value={data.pin}
                                onChange={(e) => setData('pin', e.target.value)}
                            />
                            <InputError message={errors.pin} className="mt-2" />
                        </div>
                        <PrimaryButton disabled={processing} className="rounded bg-primary px-4 py-3 text-body-sm font-semibold text-on-primary">
                            Verificar PIN
                        </PrimaryButton>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
