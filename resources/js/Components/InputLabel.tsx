import { LabelHTMLAttributes } from 'react';

export default function InputLabel({
    value,
    className = '',
    children,
    ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { value?: string }) {
    return (
        <label
            {...props}
            className={
                `block text-body-sm font-semibold text-on-surface ` +
                className
            }
        >
            {value ? value : children}
        </label>
    );
}
