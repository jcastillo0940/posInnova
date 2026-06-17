<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->string('cost_currency', 3)->default('CRC')->after('quantity');
            $table->decimal('unit_cost_original', 12, 2)->default(0)->after('cost_currency');
            $table->decimal('exchange_rate_usd_crc', 12, 4)->nullable()->after('unit_cost_original');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn(['cost_currency', 'unit_cost_original', 'exchange_rate_usd_crc']);
        });
    }
};
