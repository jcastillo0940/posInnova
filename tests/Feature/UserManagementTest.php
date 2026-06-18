<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_receives_user_management_permission(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'owner',
        ]);

        $this->actingAs($superAdmin)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('auth.permissions.manageUsers', true)
            );
    }

    public function test_only_super_admin_can_access_user_module(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $superAdmin = User::factory()->create([
            'role' => 'owner',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.users.index'))
            ->assertForbidden();

        $this->actingAs($superAdmin)
            ->get(route('admin.users.index'))
            ->assertOk();
    }

    public function test_super_admin_can_toggle_user_status_and_reset_credentials(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'owner',
        ]);

        $target = User::factory()->create([
            'role' => 'cashier',
            'is_active' => true,
            'password' => 'original-password',
            'pin_hash' => 'original-pin',
        ]);

        $this->actingAs($superAdmin)
            ->patch(route('admin.users.toggle', $target->id))
            ->assertSessionHas('success');

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'is_active' => false,
        ]);

        $this->actingAs($superAdmin)
            ->post(route('admin.users.reset-password', $target->id))
            ->assertSessionHas('success');

        $this->actingAs($superAdmin)
            ->post(route('admin.users.reset-pin', $target->id))
            ->assertSessionHas('success');

        $this->assertTrue(password_verify('1234', User::query()->findOrFail($target->id)->password));
        $this->assertTrue(password_verify('1234', User::query()->findOrFail($target->id)->pin_hash));
    }

    public function test_inactive_user_can_not_log_in(): void
    {
        $user = User::factory()->create([
            'role' => 'cashier',
            'is_active' => false,
            'password' => 'password',
        ]);

        $this->post(route('login'), [
            'email' => $user->email,
            'password' => 'password',
        ])->assertSessionHasErrors('email');
    }
}
