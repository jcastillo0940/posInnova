<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\ApprovalRequest;
use App\Models\CashSession;
use App\Models\CreditAccount;
use App\Models\Customer;
use App\Models\Layaway;
use App\Models\Promotion;
use App\Models\ReturnModel;
use App\Models\Product;
use App\Models\Sale;
use App\Services\InventoryService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;

class PosSaleController extends Controller
{
    public function store(Request $request, InventoryService $inventory): RedirectResponse
    {
        $session = CashSession::query()
            ->with(['cashRegister.branch', 'user'])
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        abort_unless($session, 422, 'Debes abrir la caja antes de registrar una venta.');

        $payload = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'sale_mode' => ['required', 'in:cash,credit,layaway,quote'],
            'discount_total' => ['nullable', 'numeric', 'min:0'],
            'cash_paid' => ['nullable', 'numeric', 'min:0'],
            'card_paid' => ['nullable', 'numeric', 'min:0'],
            'credit_paid' => ['nullable', 'numeric', 'min:0'],
            'usd_paid' => ['nullable', 'numeric', 'min:0'],
            'exchange_rate_usd_crc' => ['nullable', 'numeric', 'min:0.0001'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'price_list_multiplier' => ['nullable', 'numeric', 'min:0.01'],
            'promotion_id' => ['nullable', 'integer', 'exists:promotions,id'],
        ]);

        $customer = !empty($payload['customer_id'])
            ? Customer::query()->findOrFail($payload['customer_id'])
            : null;
        $promotion = !empty($payload['promotion_id']) ? Promotion::query()->find($payload['promotion_id']) : null;

        if ($payload['sale_mode'] === 'credit' && ! $customer) {
            throw ValidationException::withMessages([
                'customer_id' => 'Para vender a credito debes seleccionar un cliente registrado.',
            ]);
        }

        if ($payload['sale_mode'] === 'layaway' && ! $customer) {
            throw ValidationException::withMessages([
                'customer_id' => 'Para crear un apartado debes seleccionar un cliente registrado.',
            ]);
        }

        $products = Product::query()
            ->whereIn('id', collect($payload['items'])->pluck('product_id'))
            ->get()
            ->keyBy('id');

        $previewTotal = $this->previewTotal($payload, $products, $promotion);
        $payment = $this->paymentBreakdown($payload);
        $paidToday = $payment['paid_today'];
        $cashDrawerIncrease = $payment['cash_paid'] + $payment['usd_paid_crc'];
        $requestedDiscount = (float) ($payload['discount_total'] ?? 0);
        $approvalNeeded = false;
        $approvalReason = null;

        if ($payload['sale_mode'] === 'credit' && $customer) {
            $projectedCredit = (float) $customer->credit_balance + max(0, round($previewTotal - $paidToday, 2));
            if ((float) $customer->credit_limit > 0 && $projectedCredit > (float) $customer->credit_limit) {
                $approvalNeeded = true;
                $approvalReason = sprintf('El credito supera el limite por %s.', Money::format($projectedCredit - (float) $customer->credit_limit, 'CRC'));
            }
        }

        $discountCap = round($previewTotal * 0.1, 2);
        if ($requestedDiscount > $discountCap) {
            $approvalNeeded = true;
            $approvalReason = sprintf('El descuento solicitado excede el limite permitido de %s.', Money::format($discountCap, 'CRC'));
        }

        $approvalType = null;
        if ($payload['sale_mode'] === 'credit' && $customer && (float) $customer->credit_limit > 0) {
            $projectedCredit = (float) $customer->credit_balance + max(0, round($previewTotal - $paidToday, 2));
            if ($projectedCredit > (float) $customer->credit_limit) {
                $approvalType = 'credit_overlimit';
            }
        }
        if ($requestedDiscount > $discountCap) {
            $approvalType = 'discount_override';
        }

        if ($payload['sale_mode'] === 'cash' && $paidToday < round($previewTotal, 2)) {
            throw ValidationException::withMessages([
                'payment' => 'El pago recibido no cubre el total de la factura.',
            ]);
        }

        DB::transaction(function () use ($session, $payload, $products, $inventory, $request, $customer, $promotion, $payment, $approvalNeeded, $approvalReason, $approvalType, $discountCap) {
            $subtotal = 0;
            $discount = (float) ($payload['discount_total'] ?? 0);
            $paidToday = $payment['paid_today'];
            $cashDrawerIncrease = $payment['cash_paid'] + $payment['usd_paid_crc'];
            $saleMode = $payload['sale_mode'];
            $customerId = $payload['customer_id'] ?? null;
            $priceListMultiplier = (float) ($payload['price_list_multiplier'] ?? 1);
            $promotionDiscount = 0;
            $isPendingApproval = $approvalNeeded;

            $sale = Sale::create([
                'cash_session_id' => $session->id,
                'customer_id' => $customerId,
                'user_id' => $session->user_id,
                'number' => 'VENTA-' . str_pad((string) (Sale::query()->count() + 1), 6, '0', STR_PAD_LEFT),
                'status' => $isPendingApproval ? 'pending_approval' : ($saleMode === 'quote' ? 'quoted' : ($saleMode === 'layaway' ? 'layaway' : ($saleMode === 'credit' ? 'credit' : 'completed'))),
                'currency' => 'CRC',
                'subtotal' => $subtotal,
                'discount_total' => $discount,
                'tax_total' => 0,
                'total' => $subtotal,
                'paid_amount' => $saleMode === 'quote' ? 0 : $paidToday,
                'change_amount' => 0,
                'exchange_rate_usd_crc' => $payment['exchange_rate_usd_crc'],
                'usd_paid' => $payment['usd_paid'],
                'usd_paid_crc' => $payment['usd_paid_crc'],
            ]);

            foreach ($payload['items'] as $line) {
                $product = $products->get($line['product_id']);
                $maestroUnitPrice = round((float) $product->price * $priceListMultiplier, 2);
                $unitPrice = isset($line['unit_price']) && $line['unit_price'] !== null
                    ? round((float) $line['unit_price'], 2)
                    : $maestroUnitPrice;
                $unitCost = round((float) $product->cost, 2);
                $quantity = (int) $line['quantity'];
                $lineTotal = $unitPrice * $quantity;
                $lineCost = $unitCost * $quantity;
                if ($promotion?->type === 'percent') {
                    $promotionDiscount += round($lineTotal * ((float) $promotion->value / 100), 2);
                }
                if ($promotion?->type === 'fixed') {
                    $promotionDiscount += min($lineTotal, (float) $promotion->value);
                }
                if ($promotion?->type === '2x1') {
                    $freeUnits = intdiv($quantity, 2) * max(0, (int) $promotion->get_qty);
                    $promotionDiscount += $freeUnits * $unitPrice;
                }
                $subtotal += $lineTotal;

                $sale->items()->create([
                    'product_id' => $product->id,
                    'name' => $product->name,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $unitCost,
                    'quantity' => $quantity,
                    'line_total' => $lineTotal,
                    'total_cost' => $lineCost,
                    'gross_profit' => $lineTotal - $lineCost,
                ]);

                $priceDiff = round($unitPrice - $maestroUnitPrice, 2);
                if (abs($priceDiff) > 0.0001) {
                    AuditLog::create([
                        'user_id' => $request->user()->id,
                        'action' => 'sale.price_conflict',
                        'subject_type' => Sale::class,
                        'subject_id' => $sale->id,
                        'context' => [
                            'sale_number' => $sale->number,
                            'product_id' => $product->id,
                            'product_name' => $product->name,
                            'facturado' => $unitPrice,
                            'maestro' => $maestroUnitPrice,
                            'difference' => $priceDiff,
                        ],
                    ]);
                }

                if ($saleMode !== 'quote' && ! $isPendingApproval) {
                    $inventory->move(
                        product: $product,
                        type: 'sale',
                        quantity: -(int) $line['quantity'],
                        user: $request->user(),
                        referenceType: Sale::class,
                        referenceId: $sale->id,
                        context: ['sale_number' => $sale->number],
                    );
                }
            }

            $total = max(0, $subtotal - $discount - $promotionDiscount);

            $sale->update([
                'subtotal' => $subtotal,
                'total' => $total,
                'paid_amount' => $saleMode === 'quote' ? 0 : $paidToday,
                'change_amount' => $saleMode === 'cash' ? max(0, $paidToday - $total) : 0,
                'exchange_rate_usd_crc' => $payment['exchange_rate_usd_crc'],
                'usd_paid' => $payment['usd_paid'],
                'usd_paid_crc' => $payment['usd_paid_crc'],
            ]);

            if ($saleMode === 'cash' && ! $isPendingApproval) {
                $session->increment('current_cash', $cashDrawerIncrease);
            }

            if ($saleMode === 'credit' && $customerId && ! $isPendingApproval) {
                $account = CreditAccount::query()->firstOrCreate(
                    ['customer_id' => $customerId],
                    ['credit_limit' => 0, 'balance' => 0, 'status' => 'active']
                );
                $balance = max(0, $total - $paidToday);
                $account->increment('balance', $balance);
                $customer->increment('credit_balance', $balance);
            }

            if ($saleMode === 'layaway' && $customerId) {
                Layaway::create([
                    'customer_id' => $customerId,
                    'sale_id' => $sale->id,
                    'user_id' => $request->user()->id,
                    'number' => 'APAR-' . str_pad((string) (Layaway::query()->count() + 1), 6, '0', STR_PAD_LEFT),
                    'deposit' => $paidToday,
                    'balance' => max(0, $total - $paidToday),
                    'status' => 'open',
                    'due_date' => now()->addDays(15),
                ]);
            }

            if ($saleMode === 'quote') {
                $sale->update(['status' => 'quoted']);
            }

            if ($isPendingApproval) {
                ApprovalRequest::create([
                    'sale_id' => $sale->id,
                    'customer_id' => $customerId,
                    'requested_by_user_id' => $request->user()->id,
                    'type' => $approvalType ?? 'manual_review',
                    'status' => 'pending',
                    'requested_amount' => $total,
                    'credit_limit' => $customer?->credit_limit,
                    'current_credit' => $customer?->credit_balance,
                    'max_discount' => $discountCap,
                    'requested_discount' => $discount,
                    'payload' => [
                        'sale_mode' => $saleMode,
                        'items' => $payload['items'],
                        'cash_paid' => $payment['cash_paid'],
                        'card_paid' => $payment['card_paid'],
                        'credit_paid' => $payment['credit_paid'],
                        'usd_paid' => $payment['usd_paid'],
                        'exchange_rate_usd_crc' => $payment['exchange_rate_usd_crc'],
                        'price_list_multiplier' => $priceListMultiplier,
                        'promotion_id' => $payload['promotion_id'] ?? null,
                    ],
                    'reason' => $approvalReason,
                ]);
            }

            AuditLog::create([
                'user_id' => $session->user_id,
                'action' => 'sale.created',
                'subject_type' => Sale::class,
                'subject_id' => $sale->id,
                'context' => [
                    'items' => count($payload['items']),
                    'total' => max(0, $subtotal - $discount - $promotionDiscount),
                    'mode' => $saleMode,
                    'customer' => $customer?->name,
                    'promotion' => $promotion?->name,
                    'status' => $sale->status,
                ],
            ]);
        });

        return back()->with('status', $approvalNeeded ? 'Venta en espera de aprobacion' : 'Venta demo registrada');
    }

    public function approval(Sale $sale): JsonResponse
    {
        abort_unless(auth()->check(), 403);

        $approval = ApprovalRequest::query()
            ->where('sale_id', $sale->id)
            ->latest()
            ->firstOrFail();

        abort_unless($approval->status === 'approved', 422, 'La venta aun no esta aprobada.');

        return response()->json([
            'sale' => [
                'id' => $sale->id,
                'number' => $sale->number,
                'status' => $sale->status,
                'customer_id' => $sale->customer_id,
            ],
            'approval' => [
                'id' => $approval->id,
                'type' => $approval->type,
                'approved_amount' => (float) ($approval->approved_amount ?? 0),
                'requested_amount' => (float) ($approval->requested_amount ?? 0),
                'requested_discount' => $approval->requested_discount !== null ? (float) $approval->requested_discount : null,
                'max_discount' => $approval->max_discount !== null ? (float) $approval->max_discount : null,
                'credit_limit' => $approval->credit_limit !== null ? (float) $approval->credit_limit : null,
            ],
            'payload' => $approval->payload ?? [],
        ]);
    }

    public function finalizeApproved(Request $request, Sale $sale, InventoryService $inventory): RedirectResponse
    {
        abort_unless(auth()->check(), 403);

        $approval = ApprovalRequest::query()
            ->where('sale_id', $sale->id)
            ->latest()
            ->firstOrFail();

        abort_unless($sale->status === 'pending_approval', 422, 'La venta ya fue procesada.');
        abort_unless($approval->status === 'approved', 422, 'La venta aun no esta aprobada.');

        DB::transaction(function () use ($request, $sale, $approval, $inventory) {
            $payload = $approval->payload ?? [];
            $saleMode = $payload['sale_mode'] ?? 'cash';
            $approvedAmount = (float) ($approval->approved_amount ?? 0);
            $cashPaid = (float) ($payload['cash_paid'] ?? 0);
            $cardPaid = (float) ($payload['card_paid'] ?? 0);
            $creditPaid = (float) ($payload['credit_paid'] ?? 0);
            $usdPaidCrc = (float) ($sale->usd_paid_crc ?? 0);
            $paidToday = $cashPaid + $cardPaid + $creditPaid + $usdPaidCrc;

            $subtotal = 0.0;
            $promotionDiscount = 0.0;
            $priceListMultiplier = (float) ($payload['price_list_multiplier'] ?? 1);
            $promotion = !empty($payload['promotion_id']) ? Promotion::query()->find($payload['promotion_id']) : null;

            foreach (($payload['items'] ?? []) as $line) {
                $product = Product::query()->find($line['product_id']);
                if (! $product) {
                    continue;
                }

                $unitPrice = isset($line['unit_price']) && $line['unit_price'] !== null
                    ? round((float) $line['unit_price'], 2)
                    : round((float) $product->price * $priceListMultiplier, 2);
                $quantity = (int) ($line['quantity'] ?? 0);
                $lineTotal = $unitPrice * $quantity;
                $subtotal += $lineTotal;

                if ($promotion?->type === 'percent') {
                    $promotionDiscount += round($lineTotal * ((float) $promotion->value / 100), 2);
                }
                if ($promotion?->type === 'fixed') {
                    $promotionDiscount += min($lineTotal, (float) $promotion->value);
                }
                if ($promotion?->type === '2x1') {
                    $freeUnits = intdiv($quantity, 2) * max(0, (int) $promotion->get_qty);
                    $promotionDiscount += $freeUnits * $unitPrice;
                }
            }

            $finalDiscount = (float) $sale->discount_total;
            $finalTotal = (float) $sale->total;

            if ($approval->type === 'discount_override') {
                $finalDiscount = max(0, $approvedAmount);
                $finalTotal = max(0, $subtotal - $promotionDiscount - $finalDiscount);
            }

            if ($approval->type === 'credit_overlimit' && $sale->customer) {
                $sale->customer->update([
                    'credit_limit' => max(0, (float) $approvedAmount),
                ]);
            }

            foreach ($sale->items()->with('product')->get() as $item) {
                $inventory->move(
                    product: $item->product,
                    type: 'sale',
                    quantity: -(int) $item->quantity,
                    user: $request->user(),
                    referenceType: Sale::class,
                    referenceId: $sale->id,
                    context: ['sale_number' => $sale->number, 'approved_from' => 'pos_finalization'],
                );
            }

            $sale->update([
                'status' => $saleMode === 'credit' ? 'credit' : ($saleMode === 'layaway' ? 'layaway' : 'completed'),
                'discount_total' => $finalDiscount,
                'total' => $finalTotal,
                'paid_amount' => $saleMode === 'quote' ? 0 : $paidToday,
                'change_amount' => $saleMode === 'cash' ? max(0, $paidToday - $finalTotal) : 0,
            ]);

            if ($saleMode === 'cash') {
                $session = CashSession::query()->find($sale->cash_session_id);
                if ($session) {
                    $session->increment('current_cash', $cashPaid + $usdPaidCrc);
                }
            }

            if ($saleMode === 'credit' && $sale->customer) {
                $balance = max(0, $finalTotal - $paidToday);
                $account = CreditAccount::query()->firstOrCreate(
                    ['customer_id' => $sale->customer->id],
                    ['credit_limit' => 0, 'balance' => 0, 'status' => 'active']
                );
                $account->increment('balance', $balance);
                $sale->customer->increment('credit_balance', $balance);
            }

            if ($saleMode === 'layaway' && $sale->customer) {
                Layaway::create([
                    'customer_id' => $sale->customer->id,
                    'sale_id' => $sale->id,
                    'user_id' => $request->user()->id,
                    'number' => 'APAR-' . str_pad((string) (Layaway::query()->count() + 1), 6, '0', STR_PAD_LEFT),
                    'deposit' => $cashPaid + $usdPaidCrc,
                    'balance' => max(0, $finalTotal - ($cashPaid + $usdPaidCrc)),
                    'status' => 'open',
                    'due_date' => now()->addDays(15),
                ]);
            }

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'approval.sale.finalized',
                'subject_type' => Sale::class,
                'subject_id' => $sale->id,
                'context' => [
                    'approval_request_id' => $approval->id,
                    'approved_amount' => $approvedAmount,
                    'final_total' => $finalTotal,
                    'sale_mode' => $saleMode,
                    'approval_type' => $approval->type,
                ],
            ]);
        });

        return back()->with('success', 'Venta aprobada finalizada correctamente.');
    }

    private function paymentBreakdown(array $payload): array
    {
        $cashPaid = (float) ($payload['cash_paid'] ?? 0);
        $cardPaid = (float) ($payload['card_paid'] ?? 0);
        $creditPaid = (float) ($payload['credit_paid'] ?? 0);
        $crcPaid = $cashPaid + $cardPaid + $creditPaid;
        $usdPaid = (float) ($payload['usd_paid'] ?? 0);
        $exchangeRate = (float) ($payload['exchange_rate_usd_crc'] ?? 0);

        if ($usdPaid > 0 && $exchangeRate <= 0) {
            throw ValidationException::withMessages([
                'exchange_rate_usd_crc' => 'Indica el tipo de cambio USD a CRC para recibir pagos en dolares.',
            ]);
        }

        $usdPaidCrc = $usdPaid > 0 ? Money::usdToCrc($usdPaid, $exchangeRate) : 0;

        return [
            'paid_today' => round($crcPaid + $usdPaidCrc, 2),
            'cash_paid' => round($cashPaid, 2),
            'card_paid' => round($cardPaid, 2),
            'credit_paid' => round($creditPaid, 2),
            'usd_paid' => round($usdPaid, 2),
            'usd_paid_crc' => $usdPaidCrc,
            'exchange_rate_usd_crc' => $usdPaid > 0 ? round($exchangeRate, 4) : null,
        ];
    }

    private function previewTotal(array $payload, $products, ?Promotion $promotion): float
    {
        $subtotal = 0;
        $promotionDiscount = 0;
        $priceListMultiplier = (float) ($payload['price_list_multiplier'] ?? 1);

        foreach ($payload['items'] as $line) {
            $product = $products->get($line['product_id']);
            $quantity = (int) $line['quantity'];
            $unitPrice = round((float) $product->price * $priceListMultiplier, 2);
            $lineTotal = $unitPrice * $quantity;

            if ($promotion?->type === 'percent') {
                $promotionDiscount += round($lineTotal * ((float) $promotion->value / 100), 2);
            }

            if ($promotion?->type === 'fixed') {
                $promotionDiscount += min($lineTotal, (float) $promotion->value);
            }

            if ($promotion?->type === '2x1') {
                $freeUnits = intdiv($quantity, 2) * max(0, (int) $promotion->get_qty);
                $promotionDiscount += $freeUnits * $unitPrice;
            }

            $subtotal += $lineTotal;
        }

        $discount = (float) ($payload['discount_total'] ?? 0);

        return max(0, $subtotal - $discount - $promotionDiscount);
    }
}
