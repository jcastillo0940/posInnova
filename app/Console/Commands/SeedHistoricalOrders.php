<?php

namespace App\Console\Commands;

use Database\Seeders\HistoricalOrdersSeeder;
use Illuminate\Console\Command;

class SeedHistoricalOrders extends Command
{
    protected $signature = 'seed:historical-orders {--dry-run : Preview the import without writing to the database}';

    protected $description = 'Seed historical WooCommerce orders into the POS database';

    public function handle(HistoricalOrdersSeeder $seeder): int
    {
        try {
            $seeder->setContainer(app());
            $seeder->setCommand($this);
            $seeder->run(app(\App\Services\HistoricalOrdersImporter::class), (bool) $this->option('dry-run'));
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
