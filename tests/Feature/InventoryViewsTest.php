<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryViewsTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_index_redirects_to_products_view(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)
            ->get(route('admin.inventory.index'))
            ->assertRedirect(route('admin.inventory.products'));
    }

    public function test_inventory_has_separate_module_views(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->get(route('admin.inventory.products'))->assertOk();
        $this->actingAs($admin)->get(route('admin.inventory.purchases'))->assertOk();
        $this->actingAs($admin)->get(route('admin.inventory.adjustments'))->assertOk();
        $this->actingAs($admin)->get(route('admin.inventory.counts'))->assertOk();
    }

    public function test_physical_count_updates_stock_and_records_count(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $product = Product::create([
            'name' => 'Producto conteo',
            'barcode' => 'COUNT-001',
            'category' => 'Demo',
            'price' => 10,
            'cost' => 4,
            'stock' => 12,
            'is_active' => true,
        ]);

        $this->withSession([
            'supervisor_pin_verified_until' => now()->addMinutes(30),
        ]);

        $this->actingAs($admin)
            ->post(route('admin.inventory.counts.store'), [
                'product_id' => $product->id,
                'counted_quantity' => 9,
                'reason' => 'Conteo de cierre',
            ])
            ->assertRedirect();

        $this->assertSame(9, $product->fresh()->stock);
        $this->assertDatabaseHas('stock_counts', [
            'product_id' => $product->id,
            'counted_quantity' => 9,
            'system_quantity' => 12,
            'difference' => -3,
            'reason' => 'Conteo de cierre',
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'count',
            'quantity' => -3,
            'quantity_before' => 12,
            'quantity_after' => 9,
        ]);
    }
}
