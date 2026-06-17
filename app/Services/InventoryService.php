<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;

class InventoryService
{
    public function move(
        Product $product,
        string $type,
        int $quantity,
        ?User $user = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?float $unitCost = null,
        array $context = []
    ): InventoryMovement {
        $quantityBefore = $product->stock;
        $quantityAfter = $quantityBefore + $quantity;

        $product->update(['stock' => $quantityAfter]);

        return InventoryMovement::create([
            'product_id' => $product->id,
            'user_id' => $user?->id,
            'type' => $type,
            'quantity' => $quantity,
            'quantity_before' => $quantityBefore,
            'quantity_after' => $quantityAfter,
            'unit_cost' => $unitCost ?? $product->cost,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'context' => $context,
        ]);
    }
}
