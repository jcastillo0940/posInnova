<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->foreignId('reversed_by_sale_id')->nullable()->after('change_amount')->constrained('sales')->nullOnDelete();
            $table->string('reversal_reason')->nullable()->after('reversed_by_sale_id');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reversed_by_sale_id');
            $table->dropColumn('reversal_reason');
        });
    }
};
