<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CreditAccount;
use App\Models\CreditTransaction;
use App\Models\Layaway;
use App\Models\ReturnModel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OperationsActionController extends Controller
{
    public function creditPayment(Request $request, CreditAccount $creditAccount): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        DB::transaction(function () use ($request, $creditAccount, $data) {
            $creditAccount->decrement('balance', (float) $data['amount']);
            CreditTransaction::create([
                'credit_account_id' => $creditAccount->id,
                'user_id' => $request->user()->id,
                'type' => 'payment',
                'amount' => $data['amount'],
                'status' => 'posted',
                'context' => ['source' => 'admin.operations'],
            ]);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'credit.payment',
                'subject_type' => CreditAccount::class,
                'subject_id' => $creditAccount->id,
                'context' => ['amount' => $data['amount']],
            ]);
        });

        return back()->with('status', 'Abono aplicado');
    }

    public function layawayPayment(Request $request, Layaway $layaway): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        DB::transaction(function () use ($request, $layaway, $data) {
            $layaway->decrement('balance', (float) $data['amount']);
            $layaway->increment('deposit', (float) $data['amount']);
            if ((float) $layaway->balance <= 0) {
                $layaway->update(['status' => 'paid']);
            }

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'layaway.payment',
                'subject_type' => Layaway::class,
                'subject_id' => $layaway->id,
                'context' => ['amount' => $data['amount']],
            ]);
        });

        return back()->with('status', 'Abono de apartado aplicado');
    }

    public function handleReturn(Request $request, ReturnModel $return): RedirectResponse
    {
        DB::transaction(function () use ($request, $return) {
            if ($return->status === 'handled') {
                return;
            }

            $return->update(['status' => 'handled']);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'return.handled',
                'subject_type' => ReturnModel::class,
                'subject_id' => $return->id,
                'context' => ['number' => $return->number, 'amount' => $return->amount],
            ]);
        });

        return back()->with('status', 'Devolucion atendida');
    }
}
