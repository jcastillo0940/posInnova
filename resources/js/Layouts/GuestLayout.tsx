import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="min-h-screen bg-background text-on-surface">
            <main className="grid min-h-screen place-items-center px-4 py-8">
                <div className="w-full max-w-md">
                    <div className="mb-5 text-center">
                        <Link href="/" className="text-body-lg font-bold text-on-surface">
                            CorpERP
                        </Link>
                        <p className="mt-1 text-label-md text-on-surface-variant">Acceso seguro</p>
                    </div>

                    <div className="rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
