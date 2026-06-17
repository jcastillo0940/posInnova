<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('variant')->nullable()->after('category');
            $table->string('shade')->nullable()->after('variant');
            $table->string('size')->nullable()->after('shade');
            $table->string('lot_number')->nullable()->after('size');
            $table->date('expires_at')->nullable()->after('lot_number');
            $table->integer('min_stock')->default(0)->after('stock');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['variant', 'shade', 'size', 'lot_number', 'expires_at', 'min_stock']);
        });
    }
};
