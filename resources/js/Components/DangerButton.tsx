import { ButtonHTMLAttributes } from 'react';

export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={
                `inline-flex items-center rounded border border-transparent bg-error-container px-4 py-2 text-body-sm font-semibold text-on-error-container transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 active:opacity-80 ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
