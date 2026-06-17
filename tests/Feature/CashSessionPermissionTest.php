<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CashSessionPermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_cannot_close_cash_or_open_reports(): void
    {
        $cashier = User::factory()->create([
            'email_verified_at' => now(),
            'role' => 'cashier',
        ]);
        $branch = Branch::create([
            'name' => 'Sucursal permisos',
            'code' => 'BR-P1',
            'currency' => 'USD',
        ]);
        $register = CashRegister::create([
            'branch_id' => $branch->id,
            'name' => 'Caja permisos',
            'code' => 'CAJ-P1',
        ]);
        $session = CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $cashier->id,
            'opening_float' => 100,
            'current_cash' => 100,
            'status' => 'open',
            'opened_at' => Carbon::now(),
        ]);

        $this->withSession([
            'supervisor_pin_verified_until' => now()->addMinutes(30),
        ]);

        $this->actingAs($cashier)
            ->post(route('admin.cash.close', $session), [
                'counted_cash' => 100,
            ])
            ->assertForbidden();

        $this->actingAs($cashier)
            ->get(route('admin.cash.x', $session))
            ->assertForbidden();
    }
}
