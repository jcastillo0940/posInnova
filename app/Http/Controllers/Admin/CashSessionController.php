<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Sale;
use App\Models\User;
use App\Http\Controllers\Admin\SettingsController;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CashSessionController extends Controller
{
    public function index(): Response
    {
        $openSession = CashSession::query()
            ->with(['cashRegister.branch', 'user', 'closedBy'])
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        $closedSessions = CashSession::query()
            ->with(['cashRegister.branch', 'user', 'closedBy'])
            ->where('status', 'closed')
            ->latest('closed_at')
            ->limit(10)
            ->get()
            ->map(fn (CashSession $session) => $this->formatSession($session));

        return Inertia::render('Admin/Cash/Index', [
            'openSession' => $openSession ? $this->formatSession($openSession, true) : null,
            'closedSessions' => $closedSessions,
            'xReport' => $openSession ? $this->buildReport($openSession) : null,
            'canCloseCash' => auth()->user()?->canCloseCash() ?? false,
            'cashRegisters' => CashRegister::query()
                ->with('branch')
                ->where('is_active', true)
                ->orderBy('name')
                ->get()
                ->map(fn (CashRegister $register) => [
                    'id' => $register->id,
                    'name' => $register->name,
                    'branch' => $register->branch?->name,
                ]),
            'responsibleUsers' => User::query()
                ->whereIn('role', ['owner', 'admin', 'supervisor'])
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                ]),
        ]);
    }

    public function open(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->canCloseCash(), 403);

        $data = $request->validate([
            'cash_register_id' => ['required', 'exists:cash_registers,id'],
            'opening_float' => ['required', 'numeric', 'min:0'],
            'opened_by_user_id' => ['required', 'exists:users,id'],
        ]);

        abort_if(CashSession::query()->where('status', 'open')->exists(), 422, 'Ya existe una caja abierta.');

        CashSession::create([
            'cash_register_id' => $data['cash_register_id'],
            'user_id' => $request->user()->id,
            'opened_by_user_id' => $data['opened_by_user_id'],
            'opening_float' => $data['opening_float'],
            'current_cash' => $data['opening_float'],
            'status' => 'open',
            'opened_at' => now(),
        ]);

        return back()->with('success', 'Caja abierta correctamente.');
    }

    public function close(Request $request, CashSession $cashSession): RedirectResponse
    {
        abort_unless($request->user()?->canCloseCash(), 403);
        abort_unless($cashSession->status === 'open', 422, 'La caja ya fue cerrada.');
        abort_if(CashSession::query()->where('status', 'open')->whereKeyNot($cashSession->id)->exists(), 422, 'Solo se puede cerrar la caja abierta activa.');

        $data = $request->validate([
            'counted_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'closed_responsible_user_id' => ['required', 'exists:users,id'],
            'denominations' => ['nullable', 'array'],
            'denominations.*.denomination' => ['required_with:denominations', 'numeric', 'min:0.01'],
            'denominations.*.count' => ['required_with:denominations', 'integer', 'min:0'],
        ]);

        $denominations = collect($data['denominations'] ?? [])
            ->map(fn (array $row) => [
                'denomination' => round((float) $row['denomination'], 2),
                'count' => (int) $row['count'],
                'amount' => round((float) $row['denomination'] * (int) $row['count'], 2),
            ])
            ->values();

        $countedCash = isset($data['counted_cash']) && $data['counted_cash'] !== ''
            ? (float) $data['counted_cash']
            : (float) $denominations->sum('amount');

        $cashSession->fill([
            'counted_cash' => $countedCash,
            'cash_difference' => round($countedCash - (float) $cashSession->current_cash, 2),
            'closure_notes' => $data['notes'] ?? null,
            'denominations' => $denominations->all(),
            'status' => 'closed',
            'closed_at' => now(),
            'closed_by_user_id' => $request->user()?->id,
            'closed_responsible_user_id' => $data['closed_responsible_user_id'],
        ])->save();

        return back()->with('success', 'Caja cerrada con arqueo registrado.');
    }

    public function xReport(CashSession $cashSession): Response
    {
        abort_unless(auth()->user()?->canCloseCash(), 403);
        abort_unless($cashSession->status === 'open', 404);

        return Inertia::render('Admin/Cash/Report', [
            'session' => $this->buildReport($cashSession),
            'mode' => 'x',
        ]);
    }

    public function zReport(CashSession $cashSession): Response
    {
        abort_unless(auth()->user()?->canCloseCash(), 403);
        abort_unless($cashSession->status === 'closed', 404);

        return Inertia::render('Admin/Cash/Report', [
            'session' => $this->buildReport($cashSession),
            'mode' => 'z',
        ]);
    }

    public function xPdf(CashSession $cashSession): StreamedResponse
    {
        abort_unless(auth()->user()?->canCloseCash(), 403);
        abort_unless($cashSession->status === 'open', 404);

        return $this->pdfResponse($cashSession, 'x');
    }

    public function zPdf(CashSession $cashSession): StreamedResponse
    {
        abort_unless(auth()->user()?->canCloseCash(), 403);
        abort_unless($cashSession->status === 'closed', 404);

        return $this->pdfResponse($cashSession, 'z');
    }

    public function ticketPdf(CashSession $cashSession): StreamedResponse
    {
        abort_unless(auth()->user()?->canCloseCash(), 403);
        abort_unless($cashSession->status === 'closed', 404);

        $report = $this->buildReport($cashSession);
        $html = view('cash.ticket-pdf', [
            'report' => $report,
        ])->render();

        $pdf = app('dompdf.wrapper');
        $pdf->setPaper([0, 0, 226.77, 792.00]);
        $pdf->loadHTML($html);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, sprintf('cash-ticket-%s.pdf', $cashSession->id), [
            'Content-Type' => 'application/pdf',
        ]);
    }

    public function ticket(CashSession $cashSession)
    {
        abort_unless(auth()->user()?->canCloseCash(), 403);
        abort_unless($cashSession->status === 'closed', 404);

        return view('cash.ticket-print', [
            'settings' => [
                'company_name' => SettingsController::value('company_name', config('app.name')),
                'project_name' => SettingsController::value('project_name', 'RetailFlow POS'),
                'receipt_header' => SettingsController::value('receipt_header', ''),
                'receipt_footer' => SettingsController::value('receipt_footer', ''),
                'currency' => SettingsController::value('currency', 'CRC'),
            ],
            'report' => $this->buildReport($cashSession),
        ]);
    }

    private function formatSession(CashSession $session, bool $includeReport = false): array
    {
        $base = [
            'id' => $session->id,
            'status' => $session->status,
            'opening_float' => $session->opening_float,
            'current_cash' => $session->current_cash,
            'counted_cash' => $session->counted_cash,
            'cash_difference' => $session->cash_difference,
            'opened_at' => $session->opened_at?->format('d/m/Y h:i a'),
            'closed_at' => $session->closed_at?->format('d/m/Y h:i a'),
            'cash_register' => $session->cashRegister?->name,
            'branch' => $session->cashRegister?->branch?->name,
            'opened_by' => $session->user?->name,
            'closed_by' => $session->closedBy?->name,
            'opened_by_user' => $session->openedByUser?->name,
            'closed_responsible_user' => $session->closedResponsibleUser?->name,
        ];

        if ($includeReport) {
            $base['report'] = $this->buildReport($session);
        }

        return $base;
    }

    private function buildReport(CashSession $session): array
    {
        $sales = Sale::query()
            ->where('cash_session_id', $session->id)
            ->where('status', 'completed')
            ->get();

        $subtotal = $sales->sum('subtotal');
        $discounts = $sales->sum('discount_total');
        $tax = $sales->sum('tax_total');
        $total = $sales->sum('total');
        $change = $sales->sum('change_amount');
        $expectedCash = round((float) $session->opening_float + (float) $total - (float) $change, 2);

        return [
            'id' => $session->id,
            'status' => $session->status,
            'opened_at' => $session->opened_at?->format('d/m/Y h:i a'),
            'closed_at' => $session->closed_at?->format('d/m/Y h:i a'),
            'opening_float' => (float) $session->opening_float,
            'expected_cash' => $expectedCash,
            'counted_cash' => $session->counted_cash !== null ? (float) $session->counted_cash : null,
            'cash_difference' => $session->cash_difference !== null ? (float) $session->cash_difference : round((float) ($session->counted_cash ?? $expectedCash) - $expectedCash, 2),
            'sales_count' => $sales->count(),
            'subtotal' => (float) $subtotal,
            'discounts' => (float) $discounts,
            'tax' => (float) $tax,
            'total' => (float) $total,
            'cash_sales' => (float) $total,
            'change_total' => (float) $change,
            'cash_register' => $session->cashRegister?->name,
            'branch' => $session->cashRegister?->branch?->name,
            'opened_by' => $session->user?->name,
            'closed_by' => $session->closedBy?->name,
            'opened_by_user' => $session->openedByUser?->name,
            'closed_responsible_user' => $session->closedResponsibleUser?->name,
            'notes' => $session->closure_notes,
            'denominations' => $session->denominations ?? [],
        ];
    }

    private function pdfResponse(CashSession $session, string $mode): StreamedResponse
    {
        $report = $this->buildReport($session);
        $html = view('cash.report-pdf', [
            'mode' => $mode,
            'settings' => [
                'company_name' => SettingsController::value('company_name', config('app.name')),
                'project_name' => SettingsController::value('project_name', 'RetailFlow POS'),
                'receipt_header' => SettingsController::value('receipt_header', ''),
                'receipt_footer' => SettingsController::value('receipt_footer', ''),
                'currency' => SettingsController::value('currency', 'CRC'),
            ],
            'report' => $report,
        ])->render();

        $pdf = app('dompdf.wrapper');
        $pdf->loadHTML($html);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->output();
        }, sprintf('cash-report-%s-%s.pdf', $mode, $session->id), [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
