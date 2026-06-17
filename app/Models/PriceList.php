<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PriceList extends Model
{
    protected $fillable = ['name', 'type', 'multiplier', 'is_active'];

    protected function casts(): array
    {
        return [
            'multiplier' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }
}
