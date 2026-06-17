<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_sessions', function (Blueprint $table) {
            $table->decimal('counted_cash', 12, 2)->nullable()->after('current_cash');
            $table->decimal('cash_difference', 12, 2)->nullable()->after('counted_cash');
            $table->foreignId('closed_by_user_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->text('closure_notes')->nullable()->after('cash_difference');
        });
    }

    public function down(): void
    {
        Schema::table('cash_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('closed_by_user_id');
            $table->dropColumn(['counted_cash', 'cash_difference', 'closure_notes']);
        });
    }
};
