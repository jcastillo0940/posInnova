<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'pin_hash', 'role', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'pin_hash' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['owner', 'admin', 'super'], true);
    }

    public function isSuperAdmin(): bool
    {
        return in_array($this->role, ['owner', 'super'], true);
    }

    public function canBypassPin(): bool
    {
        return in_array($this->role, ['owner', 'admin', 'supervisor'], true);
    }

    public function canCloseCash(): bool
    {
        return in_array($this->role, ['owner', 'admin', 'supervisor', 'manager'], true);
    }

    public function cashSessions()
    {
        return $this->hasMany(CashSession::class);
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }
}
