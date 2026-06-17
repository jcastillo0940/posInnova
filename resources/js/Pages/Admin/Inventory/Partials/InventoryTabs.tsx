import { Link } from '@inertiajs/react';

const tabs = [
    { route: 'admin.inventory.products', label: 'Productos', icon: 'inventory_2' },
    { route: 'admin.inventory.purchases', label: 'Ordenes de compra', icon: 'receipt_long' },
    { route: 'admin.inventory.adjustments', label: 'Ajustes', icon: 'tune' },
    { route: 'admin.inventory.counts', label: 'Conteo fisico', icon: 'fact_check' },
];

export default function InventoryTabs() {
    return (
        <nav className="mb-4 flex flex-wrap gap-2 rounded-lg border border-outline-variant bg-surface p-2 shadow-sm">
            {tabs.map((tab) => (
                <Link
                    key={tab.route}
                    href={route(tab.route)}
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-body-sm font-semibold transition ${
                        route().current(tab.route)
                            ? 'bg-secondary text-on-secondary'
                            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                    {tab.label}
                </Link>
            ))}
        </nav>
    );
}
