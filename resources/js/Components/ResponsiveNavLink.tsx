import { InertiaLinkProps, Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}: InertiaLinkProps & { active?: boolean }) {
    return (
        <Link
            {...props}
            className={`flex w-full items-start border-l-4 py-2 pe-4 ps-3 ${
                active
                    ? 'border-on-surface bg-surface text-on-surface focus:border-on-surface focus:bg-surface-container-low'
                    : 'border-transparent text-on-surface-variant hover:border-outline hover:bg-surface-container-low hover:text-on-surface focus:border-outline focus:bg-surface-container-low focus:text-on-surface'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
