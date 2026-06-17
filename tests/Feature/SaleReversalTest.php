<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SaleReversalTest extends TestCase
{
    use RefreshDatabase;

    public function test_sale_can_be_voided_and_stock_restored(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'role' => 'admin',
            'pin_hash' => '1234',
        ]);
        $branch = Branch::create([
            'name' => 'Sucursal de prueba',
            'code' => 'BR-T1',
            'currency' => 'USD',
        ]);
        $register = CashRegister::create([
            'branch_id' => $branch->id,
            'name' => 'Caja prueba',
            'code' => 'CAJA-T1',
        ]);
        CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $user->id,
            'opening_float' => 100,
            'current_cash' => 100,
            'status' => 'open',
            'opened_at' => Carbon::now(),
        ]);
        $product = Product::create([
            'name' => 'Producto prueba',
            'barcode' => '999999999998',
            'category' => 'Demo',
            'price' => 10.00,
            'cost' => 5.00,
            'stock' => 10,
            'is_active' => true,
        ]);

        $this->actingAs($user)->post(route('pos.sale.store'), [
            'items' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'sale_mode' => 'cash',
            'discount_total' => 0,
            'cash_paid' => 20,
            'card_paid' => 0,
            'credit_paid' => 0,
        ]);

        $sale = Sale::query()->firstOrFail();

        $this->actingAs($user)
            ->post(route('admin.sales.void', $sale), [
                'reason' => 'Cliente solicito anular',
            ])
            ->assertRedirect();

        $this->assertSame('voided', $sale->fresh()->status);
        $this->assertSame(10, $product->fresh()->stock);
        $this->assertDatabaseHas('credit_notes', [
            'sale_id' => $sale->id,
        ]);
    }
}
