<?php

namespace Database\Seeders;

use App\Models\CreditAccount;
use App\Models\Customer;
use App\Models\Layaway;
use App\Models\ReturnModel;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Database\Seeder;

class OperationsSeeder extends Seeder
{
    public function run(): void
    {
        $customer = Customer::query()->first();
        $user = User::query()->first();
        $sale = Sale::query()->first();

        if ($customer && $user) {
            CreditAccount::firstOrCreate(
                ['customer_id' => $customer->id],
                ['credit_limit' => 250, 'balance' => 35, 'status' => 'active'],
            );

            Layaway::firstOrCreate(
                ['number' => 'APAR-000001'],
                [
                    'customer_id' => $customer->id,
                    'sale_id' => $sale?->id,
                    'user_id' => $user->id,
                    'deposit' => 20,
                    'balance' => 45,
                    'status' => 'open',
                    'due_date' => now()->addDays(15)->toDateString(),
                ],
            );

            if ($sale) {
                ReturnModel::firstOrCreate(
                    ['number' => 'DEV-000001'],
                    [
                        'sale_id' => $sale->id,
                        'user_id' => $user->id,
                        'reason' => 'Producto cambiado por cliente',
                        'amount' => 10,
                        'status' => 'processed',
                    ],
                );
            }
        }
    }
}
