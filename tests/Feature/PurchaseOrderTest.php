<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseOrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_receive_purchase_order_and_add_new_product_to_inventory(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.purchase-orders.store'), [
                'supplier_name' => 'Proveedor Belleza',
                'invoice_number' => 'FAC-100',
                'notes' => 'Compra inicial',
                'items' => [
                    [
                        'name' => 'Rubor satinado',
                        'barcode' => 'PO-0001',
                        'category' => 'Rubores',
                        'quantity' => 8,
                        'unit_cost' => 3.50,
                        'sale_price' => 9.99,
                    ],
                ],
            ])
            ->assertRedirect();

        $product = Product::query()->where('barcode', 'PO-0001')->first();

        $this->assertNotNull($product);
        $this->assertSame('Rubor satinado', $product->name);
        $this->assertSame('Rubores', $product->category);
        $this->assertSame(8, $product->stock);
        $this->assertSame('3.50', $product->cost);
        $this->assertSame('9.99', $product->price);
        $this->assertDatabaseHas('suppliers', ['name' => 'Proveedor Belleza']);
        $this->assertDatabaseHas('purchase_orders', ['invoice_number' => 'FAC-100', 'total' => 28.00]);
        $this->assertDatabaseHas('purchase_order_items', ['product_id' => $product->id, 'quantity' => 8, 'unit_cost' => 3.50]);
        $this->assertDatabaseHas('inventory_movements', ['product_id' => $product->id, 'type' => 'purchase', 'quantity' => 8, 'unit_cost' => 3.50]);
    }

    public function test_admin_can_receive_existing_product_with_updated_cost(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);
        $supplier = Supplier::create(['name' => 'Proveedor Existente']);
        $product = Product::create([
            'name' => 'Labial rojo',
            'barcode' => 'LAB-001',
            'category' => 'Labiales',
            'price' => 12.00,
            'cost' => 4.00,
            'stock' => 5,
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.purchase-orders.store'), [
                'supplier_id' => $supplier->id,
                'invoice_number' => 'FAC-101',
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 10,
                        'unit_cost' => 5.25,
                        'sale_price' => 13.50,
                    ],
                ],
            ])
            ->assertRedirect();

        $product->refresh();

        $this->assertSame(15, $product->stock);
        $this->assertSame('5.25', $product->cost);
        $this->assertSame('13.50', $product->price);
        $this->assertSame(1, PurchaseOrder::query()->count());
        $this->assertSame(1, InventoryMovement::query()->where('type', 'purchase')->count());
    }

    public function test_admin_can_receive_purchase_order_costed_in_usd_and_store_inventory_cost_in_crc(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.purchase-orders.store'), [
                'supplier_name' => 'Proveedor USA',
                'invoice_number' => 'USD-100',
                'items' => [
                    [
                        'name' => 'Base importada',
                        'barcode' => 'USD-0001',
                        'category' => 'Bases',
                        'quantity' => 3,
                        'unit_cost' => 10,
                        'cost_currency' => 'USD',
                        'exchange_rate_usd_crc' => 520,
                        'sale_price' => 9500,
                    ],
                ],
            ])
            ->assertRedirect();

        $product = Product::query()->where('barcode', 'USD-0001')->firstOrFail();

        $this->assertSame('5200.00', $product->cost);
        $this->assertSame('9500.00', $product->price);
        $this->assertDatabaseHas('purchase_orders', ['invoice_number' => 'USD-100', 'total' => 15600.00]);
        $this->assertDatabaseHas('purchase_order_items', [
            'product_id' => $product->id,
            'quantity' => 3,
            'cost_currency' => 'USD',
            'unit_cost_original' => 10.00,
            'exchange_rate_usd_crc' => 520.0000,
            'unit_cost' => 5200.00,
            'line_total' => 15600.00,
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'purchase',
            'quantity' => 3,
            'unit_cost' => 5200.00,
        ]);
    }

    public function test_cashier_can_not_receive_purchase_orders(): void
    {
        $cashier = User::factory()->create([
            'role' => 'cashier',
        ]);

        $this->actingAs($cashier)
            ->post(route('admin.purchase-orders.store'), [
                'items' => [
                    [
                        'name' => 'Producto sin permiso',
                        'quantity' => 1,
                        'unit_cost' => 1,
                    ],
                ],
            ])
            ->assertForbidden();
    }
}
