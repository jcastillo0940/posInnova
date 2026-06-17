<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Layaway extends Model
{
    protected $fillable = [
        'customer_id',
        'sale_id',
        'user_id',
        'number',
        'deposit',
        'balance',
        'status',
        'due_date',
    ];

    protected function casts(): array
    {
        return [
            'deposit' => 'decimal:2',
            'balance' => 'decimal:2',
            'due_date' => 'date',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
