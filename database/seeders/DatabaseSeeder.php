<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Customer;
use App\Models\Product;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $users = [
            ['name' => 'Dueno Demo', 'email' => 'dueno@retailflow.test', 'role' => 'owner'],
            ['name' => 'Admin Demo', 'email' => 'admin@retailflow.test', 'role' => 'admin'],
            ['name' => 'Supervisor Demo', 'email' => 'supervisor@retailflow.test', 'role' => 'supervisor'],
            ['name' => 'Cajero Demo', 'email' => 'cajero@retailflow.test', 'role' => 'cashier'],
            ['name' => 'Vendedor Demo', 'email' => 'vendedor@retailflow.test', 'role' => 'seller'],
            ['name' => 'Bodeguero Demo', 'email' => 'bodega@retailflow.test', 'role' => 'warehouse'],
            ['name' => 'Contador Demo', 'email' => 'contador@retailflow.test', 'role' => 'accountant'],
        ];

        foreach ($users as $userData) {
            User::factory()->create([
                'name' => $userData['name'],
                'email' => $userData['email'],
                'role' => $userData['role'],
                'password' => Hash::make('1234'),
                'pin_hash' => Hash::make('1234'),
            ]);
        }

        $admin = User::query()->where('email', 'admin@retailflow.test')->firstOrFail();

        foreach ([
            'currency' => 'CRC',
            'exchange_rate_usd_crc' => '520',
        ] as $key => $value) {
            SystemSetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }

        $branch = Branch::create([
            'name' => 'Sucursal Principal',
            'code' => 'BR-01',
            'currency' => 'CRC',
        ]);

        $register = CashRegister::create([
            'branch_id' => $branch->id,
            'name' => 'Caja 1',
            'code' => 'CAJA-01',
        ]);

        CashSession::create([
            'cash_register_id' => $register->id,
            'user_id' => $admin->id,
            'opening_float' => 100000,
            'current_cash' => 100000,
            'status' => 'open',
            'opened_at' => now(),
        ]);

        Customer::create([
            'name' => 'Cliente Mostrador',
            'document' => 'N/A',
            'credit_limit' => 0,
            'credit_balance' => 0,
            'status' => 'active',
        ]);

        Product::insert([
            [
                'name' => 'Labial mate nude',
                'barcode' => '750100000001',
                'category' => 'Labiales',
                'price' => 6500,
                'cost' => 3225,
                'stock' => 24,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Base líquida 24h',
                'barcode' => '750100000002',
                'category' => 'Bases',
                'price' => 9360,
                'cost' => 4888,
                'stock' => 18,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Pestañas efecto natural',
                'barcode' => '750100000003',
                'category' => 'Accesorios',
                'price' => 4550,
                'cost' => 1612,
                'stock' => 36,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->call(OperationsSeeder::class);
    }
}
