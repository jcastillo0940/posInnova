<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    protected $fillable = ['name', 'type', 'value', 'buy_qty', 'get_qty', 'is_active'];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'buy_qty' => 'integer',
            'get_qty' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
