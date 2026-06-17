<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditTransaction extends Model
{
    protected $fillable = [
        'credit_account_id',
        'sale_id',
        'user_id',
        'type',
        'amount',
        'status',
        'context',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'context' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(CreditAccount::class, 'credit_account_id');
    }
}
