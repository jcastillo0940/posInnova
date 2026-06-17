<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NavigationPermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_receives_only_allowed_navigation_permissions(): void
    {
        $cashier = User::factory()->create([
            'role' => 'cashier',
        ]);

        $this->actingAs($cashier)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('auth.permissions.accessPos', true)
                ->where('auth.permissions.accessReports', false)
                ->where('auth.permissions.accessProducts', false)
                ->where('auth.permissions.accessCustomers', true)
                ->where('auth.permissions.accessCash', true)
                ->where('auth.permissions.manageCash', false)
                ->where('auth.permissions.useSupervisorPin', false)
            );
    }

    public function test_admin_receives_admin_navigation_permissions(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $this->actingAs($admin)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('auth.permissions.accessPos', true)
                ->where('auth.permissions.accessReports', true)
                ->where('auth.permissions.accessProducts', true)
                ->where('auth.permissions.accessCustomers', true)
                ->where('auth.permissions.accessCash', true)
                ->where('auth.permissions.manageCash', true)
                ->where('auth.permissions.useSupervisorPin', true)
            );
    }
}
