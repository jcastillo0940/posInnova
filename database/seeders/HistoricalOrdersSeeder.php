<?php

namespace Database\Seeders;

use App\Services\HistoricalOrdersImporter;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class HistoricalOrdersSeeder extends Seeder
{
    public function run(HistoricalOrdersImporter $importer, bool $dryRun = false, ?string $path = null): array
    {
        $path ??= config('services.woocommerce.orders_csv_path');

        if (! is_string($path) || trim($path) === '') {
            $this->command?->warn('Historical orders seed skipped: set WOOCOMMERCE_ORDERS_CSV_PATH.');

            return [];
        }

        if (! File::exists($path)) {
            throw new \RuntimeException("Historical orders CSV not found: {$path}");
        }

        $stats = $dryRun
            ? $importer->preview($path)
            : $importer->import($path, false);

        $this->command?->info(sprintf(
            '%s historical orders from %d orders, %d line items. Completed: %d, On hold: %d, Pending payment: %d, Cancelled: %d, Refunded: %d, Other: %d.',
            $dryRun ? 'Previewed' : 'Seeded',
            $stats['orders'] ?? 0,
            $stats['items_created'] ?? 0,
            $stats['counts']['completed'] ?? 0,
            $stats['counts']['on_hold'] ?? 0,
            $stats['counts']['pending_payment'] ?? 0,
            $stats['counts']['cancelled'] ?? 0,
            $stats['counts']['refunded'] ?? 0,
            $stats['counts']['other'] ?? 0,
        ));

        return $stats;
    }
}
