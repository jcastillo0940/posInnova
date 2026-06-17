<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\CreditAccount;
use App\Models\CreditTransaction;
use App\Models\Customer;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PosCreditPaymentController extends Controller
{
    public function pendingSales(Customer $customer): JsonResponse
    {
        $sales = Sale::query()
            ->where('customer_id', $customer->id)
            ->where('status', 'credit')
            ->whereColumn('paid_amount', '<', 'total')
            ->orderBy('created_at')
            ->get(['id', 'number', 'total', 'paid_amount', 'created_at'])
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'number' => $sale->number,
                'total' => (float) $sale->total,
                'paid_amount' => (float) $sale->paid_amount,
                'balance' => max(0, (float) $sale->total - (float) $sale->paid_amount),
                'created_at' => $sale->created_at?->format('d/m/Y h:i a'),
            ]);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'document' => $customer->document,
                'credit_balance' => (float) $customer->credit_balance,
            ],
            'sales' => $sales,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'mode' => ['required', 'in:auto,manual'],
            'sale_ids' => ['nullable', 'array'],
            'sale_ids.*' => ['integer', 'exists:sales,id'],
            'allocations' => ['nullable', 'array'],
            'allocations.*.sale_id' => ['required_with:allocations', 'integer', 'exists:sales,id'],
            'allocations.*.amount' => ['required_with:allocations', 'numeric', 'min:0.01'],
        ]);

        $customer = Customer::query()->findOrFail($data['customer_id']);
        $amount = (float) $data['amount'];
        $saleIds = collect($data['sale_ids'] ?? [])->map(fn ($id) => (int) $id)->values();

        $transactionId = null;

        DB::transaction(function () use ($request, $customer, $amount, $data, $saleIds, &$transactionId) {
            $account = CreditAccount::query()->firstOrCreate(
                ['customer_id' => $customer->id],
                ['credit_limit' => $customer->credit_limit, 'balance' => 0, 'status' => 'active'],
            );

            $pendingQuery = Sale::query()
                ->where('customer_id', $customer->id)
                ->where('status', 'credit')
                ->whereColumn('paid_amount', '<', 'total');

            if ($saleIds->isNotEmpty() && $data['mode'] === 'manual') {
                $pendingQuery->whereIn('id', $saleIds);
                $pendingSales = $pendingQuery->get()->sortBy(fn (Sale $sale) => $saleIds->search($sale->id));
            } else {
                $pendingSales = $pendingQuery->orderBy('created_at')->get();
            }

            $remaining = $amount;
            $allocations = [];
            $manualAllocations = collect($data['allocations'] ?? [])->map(fn (array $row) => [
                'sale_id' => (int) $row['sale_id'],
                'amount' => (float) $row['amount'],
            ])->keyBy('sale_id');

            foreach ($pendingSales as $sale) {
                if ($remaining <= 0) {
                    break;
                }

                $balance = max(0, (float) $sale->total - (float) $sale->paid_amount);
                if ($balance <= 0) {
                    continue;
                }

                $requested = $data['mode'] === 'manual' && $manualAllocations->has($sale->id)
                    ? (float) $manualAllocations->get($sale->id)['amount']
                    : $remaining;

                $applied = min($balance, min($remaining, $requested));
                $sale->increment('paid_amount', $applied);
                if (($balance - $applied) <= 0) {
                    $sale->update(['status' => 'paid']);
                }

                $remaining -= $applied;
                $allocations[] = [
                    'sale_id' => $sale->id,
                    'sale_number' => $sale->number,
                    'amount' => $applied,
                ];
            }

            $appliedTotal = $amount - $remaining;
            if ($data['mode'] === 'manual') {
                $appliedTotal = array_sum(array_column($allocations, 'amount'));
            }
            if ($appliedTotal <= 0) {
                abort(422, 'No hay facturas pendientes para aplicar este abono.');
            }

            $account->decrement('balance', $appliedTotal);
            $customer->decrement('credit_balance', $appliedTotal);

            $transaction = CreditTransaction::create([
                'credit_account_id' => $account->id,
                'user_id' => $request->user()->id,
                'type' => 'invoice_payment',
                'amount' => $appliedTotal,
                'status' => 'posted',
                'context' => [
                    'source' => 'pos.invoice_payment',
                    'mode' => $data['mode'],
                    'requested_amount' => $amount,
                    'allocations' => $allocations,
                ],
            ]);
            $transactionId = $transaction->id;

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'credit.invoice_payment',
                'subject_type' => Customer::class,
                'subject_id' => $customer->id,
                'context' => [
                    'amount' => $appliedTotal,
                    'mode' => $data['mode'],
                    'allocations' => $allocations,
                ],
            ]);
        });

        return back()
            ->with('status', 'Abono aplicado a facturas')
            ->with('credit_payment_ticket', $transactionId);
    }

    public function ticket(CreditTransaction $creditTransaction)
    {
        $creditTransaction->loadMissing(['account.customer', 'user']);

        abort_unless($creditTransaction->type === 'invoice_payment', 404);

        return view('pos.credit-payment-ticket', [
            'settings' => [
                'company_name' => config('app.name'),
                'receipt_header' => '',
                'receipt_footer' => '',
                'currency' => 'CRC',
            ],
            'transaction' => $this->formatTransaction($creditTransaction),
        ]);
    }

    public function ticketPdf(CreditTransaction $creditTransaction): StreamedResponse
    {
        $creditTransaction->loadMissing(['account.customer', 'user']);
        abort_unless($creditTransaction->type === 'invoice_payment', 404);

        $html = view('pos.credit-payment-ticket-pdf', [
            'settings' => [
                'company_name' => config('app.name'),
                'receipt_header' => '',
                'receipt_footer' => '',
                'currency' => 'CRC',
            ],
            'transaction' => $this->formatTransaction($creditTransaction),
        ])->render();

        $pdf = app('dompdf.wrapper');
        $pdf->setPaper([0, 0, 226.77, 792.00]);
        $pdf->loadHTML($html);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, sprintf('credit-payment-%s.pdf', $creditTransaction->id), [
            'Content-Type' => 'application/pdf',
        ]);
    }

    private function formatTransaction(CreditTransaction $creditTransaction): array
    {
        $context = collect($creditTransaction->context ?? []);
        $allocations = collect($context->get('allocations', []))->map(fn (array $row) => [
            'sale_number' => $row['sale_number'] ?? ('FACT-' . ($row['sale_id'] ?? '')),
            'amount' => (float) ($row['amount'] ?? 0),
        ])->values();

        return [
            'id' => $creditTransaction->id,
            'amount' => (float) $creditTransaction->amount,
            'created_at' => $creditTransaction->created_at?->format('d/m/Y h:i a'),
            'customer' => [
                'name' => $creditTransaction->account?->customer?->name,
                'document' => $creditTransaction->account?->customer?->document,
            ],
            'user' => $creditTransaction->user?->name,
            'allocations' => $allocations,
            'reference' => strtoupper(Str::random(6)),
        ];
    }
}
