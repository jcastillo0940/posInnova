<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\StockCount;
use App\Models\Supplier;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(): RedirectResponse
    {
        return to_route('admin.inventory.products');
    }

    public function products(): Response
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        return Inertia::render('Admin/Inventory/Products', [
            'products' => $this->productsPayload(),
        ]);
    }

    public function purchases(): Response
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        return Inertia::render('Admin/Inventory/Purchases', [
            'products' => $this->productsPayload(),
            'suppliers' => Supplier::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
            'purchaseOrders' => PurchaseOrder::query()
                ->with(['supplier', 'items'])
                ->latest()
                ->limit(20)
                ->get()
                ->map(fn (PurchaseOrder $purchaseOrder) => [
                    'id' => $purchaseOrder->id,
                    'number' => $purchaseOrder->number,
                    'supplier' => $purchaseOrder->supplier?->name,
                    'invoice_number' => $purchaseOrder->invoice_number,
                    'items_count' => $purchaseOrder->items->count(),
                    'total' => $purchaseOrder->total,
                    'received_at' => $purchaseOrder->received_at?->format('d/m/Y h:i a'),
                ]),
        ]);
    }

    public function adjustments(): Response
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        return Inertia::render('Admin/Inventory/Adjustments', [
            'products' => $this->productsPayload(),
            'movements' => $this->movementsPayload(['adjustment']),
        ]);
    }

    public function counts(): Response
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        return Inertia::render('Admin/Inventory/Counts', [
            'products' => $this->productsPayload(),
            'stockCounts' => StockCount::query()
                ->with('product')
                ->latest()
                ->limit(30)
                ->get()
                ->map(fn (StockCount $count) => [
                    'product' => $count->product?->name,
                    'counted_quantity' => $count->counted_quantity,
                    'system_quantity' => $count->system_quantity,
                    'difference' => $count->difference,
                    'reason' => $count->reason,
                    'created_at' => $count->created_at?->format('d/m/Y h:i a'),
                ]),
        ]);
    }

    public function adjust(Request $request, InventoryService $inventory): RedirectResponse
    {
        abort_unless($request->user()?->canBypassPin(), 403);

        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'not_in:0'],
            'reason' => ['nullable', 'string', 'max:255'],
            'variant' => ['nullable', 'string', 'max:100'],
            'shade' => ['nullable', 'string', 'max:100'],
            'size' => ['nullable', 'string', 'max:100'],
            'lot_number' => ['nullable', 'string', 'max:100'],
            'expires_at' => ['nullable', 'date'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
        ]);

        $product = Product::query()->findOrFail($data['product_id']);
        $product->update([
            'variant' => $data['variant'] ?? $product->variant,
            'shade' => $data['shade'] ?? $product->shade,
            'size' => $data['size'] ?? $product->size,
            'lot_number' => $data['lot_number'] ?? $product->lot_number,
            'expires_at' => $data['expires_at'] ?? $product->expires_at,
            'min_stock' => $data['min_stock'] ?? $product->min_stock,
        ]);
        $inventory->move(
            product: $product,
            type: 'adjustment',
            quantity: (int) $data['quantity'],
            user: $request->user(),
            context: ['reason' => $data['reason'] ?? null],
        );

        return back()->with('status', 'Inventario ajustado');
    }

    public function count(Request $request, InventoryService $inventory): RedirectResponse
    {
        abort_unless($request->user()?->canBypassPin(), 403);

        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'counted_quantity' => ['required', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $product = Product::query()->findOrFail($data['product_id']);
        $systemQuantityBefore = $product->stock;
        $difference = (int) $data['counted_quantity'] - $systemQuantityBefore;

        if ($difference !== 0) {
            $inventory->move(
                product: $product,
                type: 'count',
                quantity: $difference,
                user: $request->user(),
                context: ['reason' => $data['reason'] ?? null],
            );
        }

        StockCount::create([
            'product_id' => $product->id,
            'user_id' => $request->user()->id,
            'counted_quantity' => (int) $data['counted_quantity'],
            'system_quantity' => $systemQuantityBefore,
            'difference' => $difference,
            'reason' => $data['reason'] ?? null,
        ]);

        return back()->with('status', 'Conteo fisico registrado');
    }

    private function productsPayload()
    {
        return Product::query()
            ->orderBy('name')
            ->get(['id', 'name', 'barcode', 'category', 'variant', 'shade', 'size', 'lot_number', 'expires_at', 'stock', 'min_stock', 'cost', 'price'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'barcode' => $product->barcode,
                'category' => $product->category,
                'variant' => $product->variant,
                'shade' => $product->shade,
                'size' => $product->size,
                'lot_number' => $product->lot_number,
                'expires_at' => $product->expires_at?->format('d/m/Y'),
                'stock' => $product->stock,
                'min_stock' => $product->min_stock,
                'cost' => $product->cost,
                'price' => $product->price,
            ]);
    }

    private function movementsPayload(array $types = [])
    {
        return InventoryMovement::query()
            ->with('product')
            ->when($types !== [], fn ($query) => $query->whereIn('type', $types))
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn (InventoryMovement $movement) => [
                'type' => $movement->type,
                'product' => $movement->product?->name,
                'quantity' => $movement->quantity,
                'before' => $movement->quantity_before,
                'after' => $movement->quantity_after,
                'unit_cost' => $movement->unit_cost,
                'created_at' => $movement->created_at?->format('d/m/Y h:i a'),
            ]);
    }
}
