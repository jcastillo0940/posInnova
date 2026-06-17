<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_password_link_screen_is_not_public(): void
    {
        $response = $this->get('/forgot-password');

        $response->assertNotFound();
    }

    public function test_reset_password_link_can_not_be_requested_publicly(): void
    {
        $response = $this->post('/forgot-password', ['email' => 'user@example.com']);

        $response->assertNotFound();
    }

    public function test_reset_password_screen_is_not_public(): void
    {
        $response = $this->get('/reset-password/token-demo');

        $response->assertNotFound();
    }

    public function test_password_can_not_be_reset_publicly(): void
    {
        $response = $this->post('/reset-password', [
            'token' => 'token-demo',
            'email' => 'user@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response->assertNotFound();
    }
}
