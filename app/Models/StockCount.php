<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockCount extends Model
{
    protected $fillable = ['product_id', 'user_id', 'counted_quantity', 'system_quantity', 'difference', 'reason'];

    protected function casts(): array
    {
        return [
            'counted_quantity' => 'integer',
            'system_quantity' => 'integer',
            'difference' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
