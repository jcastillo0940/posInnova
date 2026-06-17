<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('currency', 3)->default('CRC')->after('status');
            $table->decimal('exchange_rate_usd_crc', 12, 4)->nullable()->after('change_amount');
            $table->decimal('usd_paid', 12, 2)->default(0)->after('exchange_rate_usd_crc');
            $table->decimal('usd_paid_crc', 12, 2)->default(0)->after('usd_paid');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['currency', 'exchange_rate_usd_crc', 'usd_paid', 'usd_paid_crc']);
        });
    }
};
