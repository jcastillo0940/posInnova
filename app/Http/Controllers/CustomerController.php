<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'document' => ['nullable', 'string', 'max:50'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
        ]);

        $customer = Customer::create([
            'name' => $data['name'],
            'document' => $data['document'] ?? null,
            'credit_limit' => $data['credit_limit'] ?? 0,
            'credit_balance' => 0,
            'status' => 'active',
        ]);

        return back()->with('status', "Cliente {$customer->name} creado correctamente.");
    }
}
