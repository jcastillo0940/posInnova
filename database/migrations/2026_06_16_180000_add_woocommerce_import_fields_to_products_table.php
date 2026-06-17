<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('source_system')->nullable()->after('id');
            $table->string('source_external_id')->nullable()->after('source_system');
            $table->json('source_payload')->nullable()->after('source_external_id');
            $table->text('description')->nullable()->after('category');
            $table->text('short_description')->nullable()->after('description');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->index(['source_system', 'source_external_id']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['source_system', 'source_external_id']);
            $table->dropColumn(['source_system', 'source_external_id', 'source_payload', 'description', 'short_description']);
        });
    }
};
