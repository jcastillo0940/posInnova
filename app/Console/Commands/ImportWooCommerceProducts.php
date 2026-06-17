<?php

namespace App\Console\Commands;

use App\Services\WooCommerceProductImporter;
use Illuminate\Console\Command;

class ImportWooCommerceProducts extends Command
{
    protected $signature = 'import:woocommerce-products {csv : Path to the WooCommerce CSV export} {--dry-run : Parse and report without writing}';

    protected $description = 'Import products from a WooCommerce CSV export into the POS product catalog';

    public function handle(WooCommerceProductImporter $importer): int
    {
        $path = $this->argument('csv');

        if (!is_file($path)) {
            $this->error("CSV not found: {$path}");
            return self::FAILURE;
        }

        try {
            $stats = $importer->import($path, (bool) $this->option('dry-run'));
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return self::FAILURE;
        }

        $this->info(sprintf(
            'Processed %d rows. Created %d, updated %d, skipped %d%s',
            $stats['processed'],
            $stats['created'],
            $stats['updated'],
            $stats['skipped'],
            $this->option('dry-run') ? ' (dry run)' : '',
        ));

        return self::SUCCESS;
    }
}
