<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $fillable = ['source_system', 'source_external_id', 'source_payload', 'name', 'barcode', 'category', 'description', 'short_description', 'price', 'cost', 'stock', 'is_active', 'variant', 'shade', 'size', 'lot_number', 'expires_at', 'min_stock'];

    protected function casts(): array
    {
        return [
            'source_payload' => 'array',
            'price' => 'decimal:2',
            'cost' => 'decimal:2',
            'stock' => 'integer',
            'is_active' => 'boolean',
            'expires_at' => 'date',
            'min_stock' => 'integer',
        ];
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function purchaseOrderItems(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}
