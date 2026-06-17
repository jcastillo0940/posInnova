<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'sale_id',
        'customer_id',
        'requested_by_user_id',
        'decision_by_user_id',
        'type',
        'status',
        'requested_amount',
        'approved_amount',
        'credit_limit',
        'current_credit',
        'max_discount',
        'requested_discount',
        'payload',
        'reason',
        'decision_notes',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'requested_amount' => 'decimal:2',
            'approved_amount' => 'decimal:2',
            'credit_limit' => 'decimal:2',
            'current_credit' => 'decimal:2',
            'max_discount' => 'decimal:2',
            'requested_discount' => 'decimal:2',
            'payload' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decision_by_user_id');
    }
}
