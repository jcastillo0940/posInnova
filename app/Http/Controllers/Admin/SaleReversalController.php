<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CashSession;
use App\Models\CreditNote;
use App\Models\Sale;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleReversalController extends Controller
{
    public function store(Request $request, Sale $sale, InventoryService $inventory): RedirectResponse
    {
        abort_unless($request->user()?->canBypassPin(), 403);

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($request, $sale, $data, $inventory) {
            $sale->loadMissing('items.product');

            if ($sale->status === 'voided') {
                return;
            }

            foreach ($sale->items as $item) {
                $inventory->move(
                    product: $item->product,
                    type: 'reversal',
                    quantity: $item->quantity,
                    user: $request->user(),
                    referenceType: Sale::class,
                    referenceId: $sale->id,
                    context: ['reason' => $data['reason']],
                );
            }

            $sale->update([
                'status' => 'voided',
                'reversal_reason' => $data['reason'],
            ]);

            CreditNote::create([
                'sale_id' => $sale->id,
                'user_id' => $request->user()->id,
                'number' => 'NC-' . str_pad((string) (CreditNote::query()->count() + 1), 6, '0', STR_PAD_LEFT),
                'reason' => $data['reason'],
                'amount' => $sale->total,
                'status' => 'issued',
            ]);

            $session = CashSession::query()->find($sale->cash_session_id);
            if ($session) {
                $session->decrement('current_cash', (float) $sale->total);
            }

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'sale.voided',
                'subject_type' => Sale::class,
                'subject_id' => $sale->id,
                'context' => ['reason' => $data['reason'], 'total' => $sale->total],
            ]);
        });

        return back()->with('status', 'Venta anulada');
    }
}
