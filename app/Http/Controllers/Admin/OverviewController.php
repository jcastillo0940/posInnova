<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ApprovalRequest;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class OverviewController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(auth()->user()?->isAdmin() || in_array(auth()->user()?->role, ['supervisor', 'accountant'], true), 403);

        $today = now()->startOfDay();
        $monthStart = now()->startOfMonth();
        $yearStart = now()->startOfYear();
        $prevMonthStart = now()->subMonth()->startOfMonth();
        $prevMonthEnd = now()->subMonth()->endOfMonth();

        // Daily KPIs
        $todaySales = $this->salesKpi($today, now());
        $monthSales = $this->salesKpi($monthStart, now());
        $yearSales = $this->salesKpi($yearStart, now());
        $prevMonthSales = $this->salesKpi($prevMonthStart, $prevMonthEnd);

        // Top products this month
        $topProducts = SaleItem::query()
            ->select('name', DB::raw('SUM(quantity) as total_qty'), DB::raw('SUM(line_total) as total_revenue'), DB::raw('SUM(gross_profit) as total_profit'))
            ->whereHas('sale', fn ($q) => $q->where('created_at', '>=', $monthStart)->where('status', 'completed'))
            ->groupBy('name')
            ->orderByDesc('total_revenue')
            ->limit(8)
            ->get()
            ->map(fn ($item) => [
                'name' => $item->name,
                'qty' => (int) $item->total_qty,
                'revenue' => (float) $item->total_revenue,
                'profit' => (float) $item->total_profit,
            ]);

        // Recent sales
        $recentSales = Sale::query()
            ->with('user')
            ->where('status', '!=', 'cancelled')
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'number' => $sale->number,
                'total' => (float) $sale->total,
                'status' => $sale->status,
                'user' => $sale->user?->name,
                'created_at' => $sale->created_at?->format('d/m/Y H:i'),
            ]);

        // Sales by day (last 14 days for sparkline)
        $dailySeries = Sale::query()
            ->select(DB::raw('DATE(created_at) as day'), DB::raw('SUM(total) as total'), DB::raw('COUNT(*) as count'))
            ->where('created_at', '>=', now()->subDays(13)->startOfDay())
            ->where('status', 'completed')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(fn ($row) => ['day' => $row->day, 'total' => (float) $row->total, 'count' => (int) $row->count]);

        // Inventory alerts
        $inventoryStats = [
            'total_active' => Product::query()->where('is_active', true)->count(),
            'low_stock' => Product::query()->where('is_active', true)->whereColumn('stock', '<=', 'min_stock')->where('stock', '>', 0)->count(),
            'out_of_stock' => Product::query()->where('is_active', true)->where('stock', '<=', 0)->count(),
        ];

        $pendingApprovals = ApprovalRequest::query()->where('status', 'pending')->count();

        return Inertia::render('Admin/Overview/Index', [
            'kpis' => [
                'today' => $todaySales,
                'month' => $monthSales,
                'year' => $yearSales,
                'prev_month' => $prevMonthSales,
            ],
            'topProducts' => $topProducts,
            'recentSales' => $recentSales,
            'dailySeries' => $dailySeries,
            'inventoryStats' => $inventoryStats,
            'pendingApprovals' => $pendingApprovals,
        ]);
    }

    private function salesKpi(\DateTimeInterface $from, \DateTimeInterface $to): array
    {
        $row = Sale::query()
            ->select(
                DB::raw('COUNT(*) as count'),
                DB::raw('COALESCE(SUM(total), 0) as revenue'),
                DB::raw('COALESCE(SUM(discount_total), 0) as discounts'),
            )
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->first();

        $profit = (float) SaleItem::query()
            ->select(DB::raw('COALESCE(SUM(gross_profit), 0) as profit'))
            ->whereHas('sale', fn ($q) => $q->where('status', 'completed')->whereBetween('created_at', [$from, $to]))
            ->value('profit');

        $count = (int) ($row->count ?? 0);
        $revenue = (float) ($row->revenue ?? 0);
        $discounts = (float) ($row->discounts ?? 0);

        return [
            'count' => $count,
            'revenue' => $revenue,
            'discounts' => $discounts,
            'profit' => $profit,
            'margin' => $revenue > 0 ? round(($profit / $revenue) * 100, 1) : 0,
            'avg_ticket' => $count > 0 ? round($revenue / $count, 2) : 0,
        ];
    }
}
