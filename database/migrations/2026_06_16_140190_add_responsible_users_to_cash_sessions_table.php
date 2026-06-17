<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_sessions', function (Blueprint $table) {
            $table->foreignId('opened_by_user_id')->nullable()->after('cash_register_id')->constrained('users')->nullOnDelete();
            $table->foreignId('closed_responsible_user_id')->nullable()->after('closed_by_user_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cash_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('opened_by_user_id');
            $table->dropConstrainedForeignId('closed_responsible_user_id');
        });
    }
};
