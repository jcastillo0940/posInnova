<?php

namespace Database\Seeders;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Services\WooCommerceProductImporter;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class WooCommerceProductsSeeder extends Seeder
{
    public function run(WooCommerceProductImporter $importer): void
    {
        $path = config('services.woocommerce.products_csv_path');

        if (! is_string($path) || trim($path) === '') {
            $this->command?->warn('WooCommerce seed skipped: set SERVICES_WOOCOMMERCE_PRODUCTS_CSV_PATH to the CSV export path.');

            return;
        }

        if (! File::exists($path)) {
            throw new \RuntimeException("WooCommerce CSV not found: {$path}");
        }

        $stats = $importer->import($path);

        Product::query()
            ->where('source_system', 'woocommerce')
            ->orderBy('id')
            ->chunkById(200, function ($products) {
                foreach ($products as $product) {
                    InventoryMovement::updateOrCreate(
                        [
                            'product_id' => $product->id,
                            'type' => 'seed_import',
                            'reference_type' => 'woocommerce_seed',
                            'reference_id' => $product->id,
                        ],
                        [
                            'user_id' => null,
                            'quantity' => $product->stock,
                            'quantity_before' => 0,
                            'quantity_after' => $product->stock,
                            'unit_cost' => $product->cost,
                            'context' => [
                                'source' => 'woocommerce',
                                'imported_from_csv' => true,
                            ],
                        ]
                    );
                }
            });

        $this->command?->info(sprintf(
            'WooCommerce seed completed. Processed %d rows. Created %d, updated %d, skipped %d.',
            $stats['processed'],
            $stats['created'],
            $stats['updated'],
            $stats['skipped'],
        ));
    }
}
