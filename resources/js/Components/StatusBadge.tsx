export default function StatusBadge({
    label,
    tone,
}: {
    label: string;
    tone: 'emerald' | 'amber' | 'rose' | 'sky';
}) {
    const toneClasses = {
        emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
        amber: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
        rose: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
        sky: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
    };

    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}
        >
            <span
                className={`h-2 w-2 rounded-full ${
                    tone === 'emerald'
                        ? 'bg-emerald-400'
                        : tone === 'amber'
                          ? 'bg-amber-400'
                          : tone === 'rose'
                            ? 'bg-rose-400'
                            : 'bg-sky-400'
                }`}
            />
            {label}
        </span>
    );
}
