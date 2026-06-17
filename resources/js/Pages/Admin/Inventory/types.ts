export type Product = {
    id: number;
    name: string;
    barcode: string;
    category: string | null;
    variant: string | null;
    shade: string | null;
    size: string | null;
    lot_number: string | null;
    expires_at: string | null;
    stock: number;
    min_stock: number;
    cost: string;
    price: string;
};

export type InventoryMovement = {
    type: string;
    product: string | null;
    quantity: number;
    before: number;
    after: number;
    unit_cost: string;
    created_at: string | null;
};

export type StockCount = {
    product: string | null;
    counted_quantity: number;
    system_quantity: number;
    difference: number;
    reason: string | null;
    created_at: string | null;
};

export type SupplierOption = {
    id: number;
    name: string;
};

export type PurchaseOrderSummary = {
    id: number;
    number: string;
    supplier: string | null;
    invoice_number: string | null;
    items_count: number;
    total: string;
    received_at: string | null;
};
