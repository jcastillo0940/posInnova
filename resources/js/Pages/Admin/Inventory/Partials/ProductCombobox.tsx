import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { useState } from 'react';

type Option = { value: string; label: string };

export function ProductCombobox({
    value,
    onChange,
    options,
    placeholder = 'Buscar producto...',
}: {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
}) {
    const [query, setQuery] = useState('');

    const selected = options.find((o) => o.value === value) ?? null;

    const filtered = query === ''
        ? options.slice(0, 50)
        : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())).slice(0, 50);

    return (
        <Combobox
            value={selected}
            onChange={(option) => {
                setQuery('');
                onChange(option?.value ?? '');
            }}
            onClose={() => setQuery('')}
        >
            <div className="relative">
                <ComboboxInput
                    className="w-full rounded border border-outline bg-surface py-2 pl-3 pr-8 text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-secondary"
                    displayValue={(option: Option | null) => option?.label ?? ''}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                />
                <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px]">unfold_more</span>
                </ComboboxButton>

                <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full min-w-[240px] overflow-auto rounded border border-outline-variant bg-surface shadow-lg focus:outline-none">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-body-sm text-on-surface-variant">Sin resultados</div>
                    ) : (
                        filtered.map((option) => (
                            <ComboboxOption
                                key={option.value}
                                value={option}
                                className="cursor-pointer px-3 py-2 text-body-sm text-on-surface data-[focus]:bg-surface-container-low"
                            >
                                {option.label}
                            </ComboboxOption>
                        ))
                    )}
                </ComboboxOptions>
            </div>
        </Combobox>
    );
}
