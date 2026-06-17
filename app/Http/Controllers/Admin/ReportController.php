<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(): Response
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        return Inertia::render('Admin/Reports/Index', [
            'metrics' => [
                'salesToday' => Sale::query()->whereDate('created_at', today())->count(),
                'salesTotal' => Sale::query()->sum('total'),
                'grossProfit' => SaleItem::query()->sum('gross_profit'),
                'inventoryCost' => Product::query()->selectRaw('COALESCE(SUM(stock * cost), 0) as value')->value('value') ?? 0,
                'lowStock' => Product::query()->where('stock', '<=', 10)->count(),
                'auditEntries' => AuditLog::query()->count(),
            ],
            'openCashSession' => ($openSession = CashSession::query()
                ->with(['cashRegister.branch'])
                ->where('status', 'open')
                ->latest('opened_at')
                ->first()) ? [
                'id' => $openSession->id,
                'cash_register' => $openSession->cashRegister?->name,
                'branch' => $openSession->cashRegister?->branch?->name,
                'status' => $openSession->status,
                'current_cash' => $openSession->current_cash,
                'opened_at' => $openSession->opened_at?->format('d/m/Y h:i a'),
            ] : null,
            'recentAudits' => AuditLog::query()
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn (AuditLog $log) => [
                    'action' => $log->action,
                    'subject_type' => $log->subject_type,
                    'subject_id' => $log->subject_id,
                    'created_at' => $log->created_at?->format('d/m/Y h:i a'),
                ]),
            'recentSales' => Sale::query()
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn (Sale $sale) => [
                    'id' => $sale->id,
                    'number' => $sale->number,
                    'total' => $sale->total,
                    'status' => $sale->status,
                    'created_at' => $sale->created_at?->format('d/m/Y h:i a'),
                ]),
        ]);
    }
}
