export function FieldInput({
    value,
    onChange,
    placeholder,
    type = 'text',
}: {
    value: string | number;
    onChange: (value: string) => void;
    placeholder: string;
    type?: string;
}) {
    return (
        <input
            className="w-full rounded border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant"
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
        />
    );
}

export function FieldSelect({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <select
            className="w-full rounded border border-outline bg-surface px-3 py-2 text-body-sm text-on-surface"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
