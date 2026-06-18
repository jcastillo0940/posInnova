<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\CashSession;
use App\Models\CreditAccount;
use App\Models\ApprovalRequest;
use App\Models\Layaway;
use App\Models\Sale;
use App\Services\InventoryService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ApprovalRequestController extends Controller
{
    public function index(): Response
    {
        abort_unless(auth()->user()?->isAdmin() || auth()->user()?->canBypassPin(), 403);

        return Inertia::render('Admin/Approvals/Index', [
            'requests' => ApprovalRequest::query()
                ->with(['sale.customer', 'customer', 'requester', 'decider'])
                ->latest()
                ->limit(100)
                ->get()
                ->map(fn (ApprovalRequest $request) => $this->formatRequest($request)),
        ]);
    }

    public function approve(Request $request, ApprovalRequest $approvalRequest, InventoryService $inventory): RedirectResponse
    {
        abort_unless(auth()->user()?->isAdmin() || auth()->user()?->canBypassPin(), 403);
        abort_unless($approvalRequest->status === 'pending', 422, 'La solicitud ya fue resuelta.');

        $data = $request->validate([
            'decision_notes' => ['nullable', 'string', 'max:2000'],
            'approved_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($request, $approvalRequest, $data) {
            $sale = $approvalRequest->sale()->with(['items.product', 'customer'])->firstOrFail();
            abort_unless($sale->status === 'pending_approval', 422, 'La venta ya fue procesada.');
            $payload = $approvalRequest->payload ?? [];
            $approvedAmount = (float) ($data['approved_amount'] ?? $approvalRequest->requested_amount ?? $sale->total);

            $approvalRequest->update([
                'status' => 'approved',
                'decision_by_user_id' => $request->user()->id,
                'decision_notes' => $data['decision_notes'] ?? null,
                'approved_amount' => $approvedAmount,
                'decided_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'approval.sale.approved',
                'subject_type' => Sale::class,
                'subject_id' => $sale->id,
                'context' => [
                    'approval_request_id' => $approvalRequest->id,
                    'approved_amount' => $approvedAmount,
                    'sale_mode' => $payload['sale_mode'] ?? 'cash',
                    'approval_type' => $approvalRequest->type,
                ],
            ]);
        });

        return back()->with('success', 'Solicitud aprobada.');
    }

    public function reject(Request $request, ApprovalRequest $approvalRequest): RedirectResponse
    {
        abort_unless(auth()->user()?->isAdmin() || auth()->user()?->canBypassPin(), 403);
        abort_unless($approvalRequest->status === 'pending', 422, 'La solicitud ya fue resuelta.');

        $data = $request->validate([
            'decision_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($request, $approvalRequest, $data) {
            $sale = $approvalRequest->sale()->first();
            if ($sale && $sale->status === 'pending_approval') {
                $sale->update(['status' => 'rejected']);
            }

            $approvalRequest->update([
                'status' => 'rejected',
                'decision_by_user_id' => $request->user()->id,
                'decision_notes' => $data['decision_notes'],
                'decided_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'approval.sale.rejected',
                'subject_type' => Sale::class,
                'subject_id' => $sale?->id,
                'context' => [
                    'approval_request_id' => $approvalRequest->id,
                    'sale_number' => $sale?->number,
                    'notes' => $data['decision_notes'] ?? null,
                ],
            ]);
        });

        return back()->with('success', 'Solicitud rechazada.');
    }

    private function formatRequest(ApprovalRequest $request): array
    {
        $pendingCredit = $request->requested_amount !== null
            && $request->credit_limit !== null
            ? max(0, (float) $request->requested_amount - (float) $request->credit_limit)
            : null;

        return [
            'id' => $request->id,
            'type' => $request->type,
            'status' => $request->status,
            'requested_amount' => (float) ($request->requested_amount ?? 0),
            'approved_amount' => $request->approved_amount !== null ? (float) $request->approved_amount : null,
            'credit_limit' => $request->credit_limit !== null ? (float) $request->credit_limit : null,
            'current_credit' => $request->current_credit !== null ? (float) $request->current_credit : null,
            'max_discount' => $request->max_discount !== null ? (float) $request->max_discount : null,
            'requested_discount' => $request->requested_discount !== null ? (float) $request->requested_discount : null,
            'reason' => $request->reason,
            'decision_notes' => $request->decision_notes,
            'created_at' => $request->created_at?->format('d/m/Y h:i a'),
            'decided_at' => $request->decided_at?->format('d/m/Y h:i a'),
            'pending_credit' => $pendingCredit,
            'sale' => $request->sale ? [
                'id' => $request->sale->id,
                'number' => $request->sale->number,
                'total' => (float) $request->sale->total,
                'status' => $request->sale->status,
                'customer' => $request->sale->customer?->name,
            ] : null,
            'customer' => $request->customer ? [
                'id' => $request->customer->id,
                'name' => $request->customer->name,
                'document' => $request->customer->document,
            ] : null,
            'requester' => $request->requester?->name,
            'decider' => $request->decider?->name,
        ];
    }
}
