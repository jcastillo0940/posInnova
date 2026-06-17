<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CashSessionClosureTest extends TestCase
{
    use RefreshDatabase;

    public function test_cash_session_can_be_closed_with_counted_cash_and_difference(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'role' => 'admin',
        ]);
        $branch = Branch::create([
            'name' => 'Sucursal cierre',
            'code' => 'BR-C1',
            'currency' => 'USD',
        ]);
        $register = CashRegister::create([
            'branch_id' => $branch->id,
            'name' => 'Caja cierre',
            'code' => 'CAJ-C1',
        ]);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $user->id,
            'opening_float' => 100,
            'current_cash' => 150,
            'status' => 'open',
            'opened_at' => Carbon::now(),
        ]);
        Product::create([
            'name' => 'Producto cierre',
            'barcode' => '111111111111',
            'category' => 'Demo',
            'price' => 25.00,
            'cost' => 10.00,
            'stock' => 10,
            'is_active' => true,
        ]);

        $this->withSession([
            'supervisor_pin_verified_until' => now()->addMinutes(30),
        ]);

        $this->actingAs($user)
            ->post(route('admin.cash.close', $session), [
                'counted_cash' => 148.50,
                'notes' => 'Faltante menor',
                'closed_responsible_user_id' => $user->id,
                'denominations' => [],
            ])
            ->assertRedirect();

        $session->refresh();

        $this->assertSame('closed', $session->status);
        $this->assertSame('148.50', $session->counted_cash);
        $this->assertSame('-1.50', $session->cash_difference);
        $this->assertNotNull($session->closed_at);
        $this->assertSame($user->id, $session->closed_by_user_id);
    }

    public function test_x_and_z_reports_are_available_for_matching_session_state(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => now(),
            'role' => 'admin',
        ]);
        $branch = Branch::create([
            'name' => 'Sucursal reporte',
            'code' => 'BR-R1',
            'currency' => 'USD',
        ]);
        $register = CashRegister::create([
            'branch_id' => $branch->id,
            'name' => 'Caja reporte',
            'code' => 'CAJ-R1',
        ]);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $user->id,
            'opening_float' => 100,
            'current_cash' => 100,
            'status' => 'open',
            'opened_at' => Carbon::now(),
        ]);

        $this->actingAs($user)
            ->get(route('admin.cash.x', $session))
            ->assertOk();

        $session->update([
            'status' => 'closed',
            'counted_cash' => 100,
            'cash_difference' => 0,
            'closed_at' => now(),
            'closed_by_user_id' => $user->id,
        ]);

        $this->actingAs($user)
            ->get(route('admin.cash.z', $session))
            ->assertOk();
    }
}
