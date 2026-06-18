<?php

namespace App\Http\Controllers;

use App\Models\CashSession;
use App\Models\ApprovalRequest;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\PriceList;
use App\Models\Promotion;
use App\Http\Controllers\Admin\SettingsController;
use App\Support\Money;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $openSession = CashSession::query()
            ->with(['cashRegister.branch', 'user'])
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();
        $settingsCurrency = SettingsController::value('currency', 'CRC');
        $exchangeRate = (float) SettingsController::value('exchange_rate_usd_crc', '0');
        $autoPrintReceipts = SettingsController::value('auto_print_receipts', '0') === '1';

        $recentSales = Sale::query()
            ->with(['customer', 'user'])
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'number' => $sale->number,
                'total' => $sale->total,
                'status' => $sale->status,
                'created_at' => $sale->created_at?->format('d/m/Y h:i a'),
            ]);

        $recentApprovalRequests = ApprovalRequest::query()
            ->with(['sale'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (ApprovalRequest $request) => [
                'id' => $request->id,
                'sale_id' => $request->sale_id,
                'sale_number' => $request->sale?->number,
                'type' => $request->type,
                'status' => $request->status,
                'requested_amount' => $request->requested_amount !== null ? (float) $request->requested_amount : null,
                'approved_amount' => $request->approved_amount !== null ? (float) $request->approved_amount : null,
                'decision_notes' => $request->decision_notes,
                'reason' => $request->reason,
                'decided_at' => $request->decided_at?->format('d/m/Y h:i a'),
            ]);

        return Inertia::render('Dashboard', [
            'openSession' => $openSession ? [
                'id' => $openSession->id,
                'cashRegister' => $openSession->cashRegister?->name,
                'branch' => $openSession->cashRegister?->branch?->name,
                'user' => $openSession->user?->name,
                'status' => $openSession->status,
                'openedAt' => $openSession->opened_at?->format('d/m/Y h:i a'),
                'openingFloat' => (float) $openSession->opening_float,
                'currentCash' => (float) $openSession->current_cash,
            ] : null,
            'currency' => $settingsCurrency,
            'exchangeRateUsdCrc' => $exchangeRate,
            'autoPrintReceipts' => $autoPrintReceipts,
            'productsCount' => Product::query()->where('is_active', true)->count(),
            'productsLowStock' => Product::query()->where('stock', '<=', 10)->count(),
            'recentSales' => $recentSales,
            'approvalRequests' => $recentApprovalRequests,
            'products' => Product::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'barcode', 'price', 'stock', 'category'])
                ->map(fn (Product $product) => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'barcode' => $product->barcode,
                    'price' => (float) $product->price,
                    'stock' => $product->stock,
                    'category' => $product->category,
                ]),
            'customers' => Customer::query()
                ->orderBy('name')
                ->limit(100)
                ->get(['id', 'name', 'document', 'credit_limit', 'credit_balance', 'status'])
                ->map(fn (Customer $customer) => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'document' => $customer->document,
                    'credit_limit' => (float) $customer->credit_limit,
                    'credit_balance' => (float) $customer->credit_balance,
                    'status' => $customer->status,
                ]),
            'priceLists' => PriceList::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'type', 'multiplier'])
                ->map(fn (PriceList $priceList) => [
                    'id' => $priceList->id,
                    'name' => $priceList->name,
                    'type' => $priceList->type,
                    'multiplier' => (float) $priceList->multiplier,
                ]),
            'promotions' => Promotion::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'type', 'value', 'buy_qty', 'get_qty'])
                ->map(fn (Promotion $promotion) => [
                    'id' => $promotion->id,
                    'name' => $promotion->name,
                    'type' => $promotion->type,
                    'value' => (float) $promotion->value,
                    'buy_qty' => $promotion->buy_qty,
                    'get_qty' => $promotion->get_qty,
                ]),
        ]);
    }
}
