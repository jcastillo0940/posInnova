<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\CreditAccount;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class PosSaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_sale_is_created_from_dashboard_action(): void
    {
        [$user, $product] = $this->openRegisterWithProduct();

        $this->actingAs($user)
            ->post(route('pos.sale.store'), [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 2],
                ],
                'sale_mode' => 'cash',
                'discount_total' => 0,
                'cash_paid' => 20,
                'card_paid' => 0,
                'credit_paid' => 0,
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('sales', 1);
        $this->assertDatabaseCount('sale_items', 1);
        $this->assertDatabaseHas('sale_items', [
            'product_id' => $product->id,
            'unit_cost' => 5.00,
            'total_cost' => 10.00,
            'gross_profit' => 10.00,
        ]);

        $sale = Sale::query()->first();

        $this->assertNotNull($sale);
        $this->assertSame('completed', $sale->status);
    }

    public function test_cash_sale_is_rejected_when_payment_is_less_than_invoice_total(): void
    {
        [$user, $product] = $this->openRegisterWithProduct();

        $this->actingAs($user)
            ->post(route('pos.sale.store'), [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 2],
                ],
                'sale_mode' => 'cash',
                'discount_total' => 0,
                'cash_paid' => 5,
                'card_paid' => 0,
                'credit_paid' => 0,
            ])
            ->assertSessionHasErrors('payment');

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame(10, $product->refresh()->stock);
    }

    public function test_credit_sale_keeps_only_unpaid_amount_as_customer_balance(): void
    {
        [$user, $product] = $this->openRegisterWithProduct();
        $customer = Customer::create([
            'name' => 'Cliente credito',
            'document' => 'CR-001',
            'credit_limit' => 100,
            'credit_balance' => 0,
            'status' => 'active',
        ]);

        $this->actingAs($user)
            ->post(route('pos.sale.store'), [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 2],
                ],
                'customer_id' => $customer->id,
                'sale_mode' => 'credit',
                'discount_total' => 0,
                'cash_paid' => 0,
                'card_paid' => 0,
                'credit_paid' => 5,
            ])
            ->assertRedirect();

        $sale = Sale::query()->firstOrFail();
        $account = CreditAccount::query()->where('customer_id', $customer->id)->firstOrFail();

        $this->assertSame('credit', $sale->status);
        $this->assertSame('5.00', $sale->paid_amount);
        $this->assertSame('15.00', $account->balance);
        $this->assertSame('15.00', $customer->refresh()->credit_balance);
    }

    public function test_cash_sale_can_be_paid_in_usd_and_change_is_calculated_in_crc(): void
    {
        [$user, $product] = $this->openRegisterWithProduct([
            'price' => 10000,
            'cost' => 5000,
        ]);

        $this->actingAs($user)
            ->post(route('pos.sale.store'), [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 1],
                ],
                'sale_mode' => 'cash',
                'discount_total' => 0,
                'cash_paid' => 0,
                'card_paid' => 0,
                'credit_paid' => 0,
                'usd_paid' => 20,
                'exchange_rate_usd_crc' => 520,
            ])
            ->assertRedirect();

        $sale = Sale::query()->firstOrFail();

        $this->assertSame('10000.00', $sale->total);
        $this->assertSame('10400.00', $sale->paid_amount);
        $this->assertSame('400.00', $sale->change_amount);
        $this->assertSame('20.00', $sale->usd_paid);
        $this->assertSame('10400.00', $sale->usd_paid_crc);
        $this->assertSame('520.0000', $sale->exchange_rate_usd_crc);
    }

    private function openRegisterWithProduct(array $productOverrides = []): array
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
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
        $product = Product::create(array_merge([
            'name' => 'Producto prueba',
            'barcode' => '999999999999',
            'category' => 'Demo',
            'price' => 10.00,
            'cost' => 5.00,
            'stock' => 10,
            'is_active' => true,
        ], $productOverrides));

        return [$user, $product];
    }
}
