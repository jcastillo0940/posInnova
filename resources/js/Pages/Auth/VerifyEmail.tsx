import PrimaryButton from '@/Components/PrimaryButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <GuestLayout>
            <Head title="Verificar correo" />

            <div className="mb-4">
                <h1 className="text-headline-lg text-on-surface">Verifica tu correo</h1>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                    Antes de entrar, confirma tu correo con el enlace que te enviamos. Si no llego, puedes reenviarlo.
                </p>
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-body-sm font-semibold text-emerald-700">
                    Enviamos un nuevo enlace de verificacion al correo registrado.
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mt-4 flex items-center justify-between">
                    <PrimaryButton disabled={processing}>
                        Reenviar verificacion
                    </PrimaryButton>

                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="rounded text-body-sm text-on-surface underline hover:text-secondary focus:outline-none focus:ring-2 focus:ring-outline focus:ring-offset-2"
                    >
                        Salir
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
