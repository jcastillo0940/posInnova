<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Services\InventoryService;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    public function store(Request $request, InventoryService $inventory): RedirectResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        $data = $request->validate([
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'supplier_name' => ['nullable', 'string', 'max:160'],
            'invoice_number' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.name' => ['nullable', 'string', 'max:255', 'required_without:items.*.product_id'],
            'items.*.barcode' => ['nullable', 'string', 'max:100'],
            'items.*.category' => ['nullable', 'string', 'max:160'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999999'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0', 'max:999999999'],
            'items.*.cost_currency' => ['nullable', 'string', 'in:CRC,USD'],
            'items.*.exchange_rate_usd_crc' => ['nullable', 'numeric', 'min:0.0001'],
            'items.*.sale_price' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
        ]);

        DB::transaction(function () use ($request, $data, $inventory) {
            $supplier = $this->resolveSupplier($data);
            $subtotal = collect($data['items'])->sum(
                fn (array $item) => $this->unitCostInCrc($item) * (int) $item['quantity']
            );

            $purchaseOrder = PurchaseOrder::create([
                'supplier_id' => $supplier?->id,
                'user_id' => $request->user()?->id,
                'number' => $this->nextNumber(),
                'invoice_number' => $data['invoice_number'] ?? null,
                'status' => 'received',
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'notes' => $data['notes'] ?? null,
                'received_at' => now(),
            ]);

            foreach ($data['items'] as $item) {
                $quantity = (int) $item['quantity'];
                $costCurrency = strtoupper($item['cost_currency'] ?? 'CRC');
                $unitCostOriginal = round((float) $item['unit_cost'], 2);
                $exchangeRate = $costCurrency === 'USD' ? round((float) $item['exchange_rate_usd_crc'], 4) : null;
                $unitCost = $this->unitCostInCrc($item);
                $salePrice = array_key_exists('sale_price', $item) && $item['sale_price'] !== null && $item['sale_price'] !== ''
                    ? round((float) $item['sale_price'], 2)
                    : null;
                $product = $this->resolveProduct($item, $unitCost);

                $product->update([
                    'cost' => $unitCost,
                    'price' => $salePrice ?? $product->price,
                    'category' => $item['category'] ?? $product->category,
                    'is_active' => true,
                ]);

                $purchaseOrder->items()->create([
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'barcode' => $product->barcode,
                    'quantity' => $quantity,
                    'cost_currency' => $costCurrency,
                    'unit_cost_original' => $unitCostOriginal,
                    'exchange_rate_usd_crc' => $exchangeRate,
                    'unit_cost' => $unitCost,
                    'sale_price' => $salePrice,
                    'line_total' => $unitCost * $quantity,
                ]);

                $inventory->move(
                    product: $product,
                    type: 'purchase',
                    quantity: $quantity,
                    user: $request->user(),
                    referenceType: PurchaseOrder::class,
                    referenceId: $purchaseOrder->id,
                    unitCost: $unitCost,
                    context: [
                        'purchase_order' => $purchaseOrder->number,
                        'supplier' => $supplier?->name,
                        'invoice_number' => $purchaseOrder->invoice_number,
                        'cost_currency' => $costCurrency,
                        'unit_cost_original' => $unitCostOriginal,
                        'exchange_rate_usd_crc' => $exchangeRate,
                    ],
                );
            }

            AuditLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'purchase_order.received',
                'subject_type' => PurchaseOrder::class,
                'subject_id' => $purchaseOrder->id,
                'context' => [
                    'number' => $purchaseOrder->number,
                    'items' => count($data['items']),
                    'total' => $purchaseOrder->total,
                    'supplier' => $supplier?->name,
                ],
            ]);
        });

        return back()->with('status', 'Orden de compra recibida e inventario actualizado');
    }

    private function unitCostInCrc(array $item): float
    {
        $costCurrency = strtoupper($item['cost_currency'] ?? 'CRC');
        $unitCost = (float) $item['unit_cost'];

        if ($costCurrency === 'USD') {
            $exchangeRate = (float) ($item['exchange_rate_usd_crc'] ?? 0);

            if ($exchangeRate <= 0) {
                throw ValidationException::withMessages([
                    'items' => 'Indica el tipo de cambio USD a CRC para costos en dolares.',
                ]);
            }

            return Money::usdToCrc($unitCost, $exchangeRate);
        }

        return round($unitCost, 2);
    }

    private function resolveSupplier(array $data): ?Supplier
    {
        if (! empty($data['supplier_id'])) {
            return Supplier::query()->find($data['supplier_id']);
        }

        if (! empty($data['supplier_name'])) {
            return Supplier::query()->firstOrCreate(
                ['name' => trim($data['supplier_name'])],
                ['is_active' => true],
            );
        }

        return null;
    }

    private function resolveProduct(array $item, float $unitCost): Product
    {
        if (! empty($item['product_id'])) {
            return Product::query()->findOrFail($item['product_id']);
        }

        $barcode = $item['barcode'] ?? null;
        if ($barcode && Product::query()->where('barcode', $barcode)->exists()) {
            return Product::query()->where('barcode', $barcode)->firstOrFail();
        }

        return Product::create([
            'name' => trim((string) $item['name']),
            'barcode' => $barcode ?: $this->newAutoBarcode(),
            'category' => $item['category'] ?? null,
            'price' => (float) ($item['sale_price'] ?? $unitCost),
            'cost' => $unitCost,
            'stock' => 0,
            'is_active' => true,
        ]);
    }

    private function nextNumber(): string
    {
        return 'OC-' . str_pad((string) (PurchaseOrder::query()->count() + 1), 6, '0', STR_PAD_LEFT);
    }

    private function newAutoBarcode(): string
    {
        do {
            $barcode = 'AUTO-' . Str::upper(Str::random(10));
        } while (Product::query()->where('barcode', $barcode)->exists());

        return $barcode;
    }
}
