<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CreditAccount;
use App\Models\Layaway;
use App\Models\ReturnModel;
use Inertia\Inertia;
use Inertia\Response;

class OperationsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Operations/Index', [
            'creditAccounts' => CreditAccount::query()->with('customer')->limit(10)->get(),
            'layaways' => Layaway::query()->with('customer')->latest()->limit(10)->get(),
            'returns' => ReturnModel::query()->with('sale')->latest()->limit(10)->get(),
        ]);
    }
}
