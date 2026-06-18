<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class HistoricalOrdersImporter
{
    public function import(string $path, bool $dryRun = false): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open historical orders CSV.');
        }

        $headers = fgetcsv($handle);
        if (! is_array($headers)) {
            fclose($handle);
            throw new \RuntimeException('Historical orders CSV appears to be empty.');
        }

        $headers = array_map([$this, 'normalizeHeader'], $headers);
        $grouped = [];

        while (($row = fgetcsv($handle)) !== false) {
            if ($row === [null] || count(array_filter($row, fn ($value) => $value !== null && $value !== '')) === 0) {
                continue;
            }

            $assoc = array_combine($headers, array_pad($row, count($headers), null));
            if (! is_array($assoc)) {
                continue;
            }

            $orderNumber = trim((string) ($assoc['numerodepedido'] ?? ''));
            if ($orderNumber === '') {
                continue;
            }

            $grouped[$orderNumber][] = $assoc;
        }

        fclose($handle);

        $stats = [
            'orders' => count($grouped),
            'line_items' => 0,
            'sales_created' => 0,
            'items_created' => 0,
            'counts' => [
                'completed' => 0,
                'on_hold' => 0,
                'pending_payment' => 0,
                'cancelled' => 0,
                'refunded' => 0,
                'other' => 0,
            ],
            'sample_orders' => [],
        ];

        $customer = null;
        $user = null;
        $sessionId = null;

        if (! $dryRun) {
            $customer = Customer::query()->firstOrCreate(
                ['document' => 'OPEN-CUSTOMER'],
                ['name' => 'Cliente Mostrador', 'credit_limit' => 0, 'credit_balance' => 0, 'status' => 'active']
            );
            $user = User::query()->orderBy('id')->firstOrFail();
            $sessionId = (int) \DB::table('cash_sessions')->orderBy('id')->value('id');
        }

        DB::beginTransaction();
        try {
            foreach ($grouped as $orderNumber => $lines) {
                $first = $lines[0];
                $sourceStatus = trim((string) ($first['estadodelpedido'] ?? ''));
                $normalizedStatus = $this->mapStatus($sourceStatus);
                $stats['counts'][$normalizedStatus] = ($stats['counts'][$normalizedStatus] ?? 0) + 1;
                $stats['line_items'] += count($lines);

                if (count($stats['sample_orders']) < 5) {
                    $stats['sample_orders'][] = [
                        'order' => $orderNumber,
                        'status' => $sourceStatus,
                        'mapped_status' => $normalizedStatus,
                        'lines' => count($lines),
                        'total' => (float) ($this->money($first['importetotaldelpedido'] ?? 0) ?? 0),
                    ];
                }

                if ($dryRun) {
                    continue;
                }

                $subtotal = 0.0;
                $discount = 0.0;
                $tax = (float) ($this->money($first['importetotaldeimpuestosdelpedido'] ?? 0) ?? 0);
                $total = (float) ($this->money($first['importetotaldelpedido'] ?? 0) ?? 0);

                foreach ($lines as $line) {
                    $quantity = max(1, (int) ($line['cantidadreembolso'] ?? $line['cantidad'] ?? 1));
                    $unitPrice = (float) ($this->money($line['costedearticulo'] ?? 0) ?? 0);
                    $subtotal += $unitPrice * $quantity;
                    $discount += (float) ($this->money($line['importededescuento'] ?? 0) ?? 0);
                }

                $sale = Sale::query()->firstOrCreate(
                    ['number' => 'HIST-' . $orderNumber],
                    [
                        'cash_session_id' => $sessionId,
                        'customer_id' => $customer->id,
                        'user_id' => $user->id,
                        'status' => $normalizedStatus,
                        'currency' => 'CRC',
                        'subtotal' => $subtotal,
                        'discount_total' => $discount,
                        'tax_total' => $tax,
                        'total' => $total > 0 ? $total : ($subtotal - $discount + $tax),
                        'paid_amount' => $total > 0 ? $total : ($subtotal - $discount + $tax),
                        'change_amount' => 0,
                        'notes' => $this->buildNotes($orderNumber, $sourceStatus, $lines),
                    ]
                );

                $stats['sales_created']++;

                foreach ($lines as $line) {
                    $name = trim((string) ($line['nombredelarticulo'] ?? 'Producto historico'));
                    $sku = trim((string) ($line['sku'] ?? ''));
                    $quantity = max(1, (int) ($line['cantidadreembolso'] ?? $line['cantidad'] ?? 1));
                    $unitPrice = (float) ($this->money($line['costedearticulo'] ?? 0) ?? 0);
                    $lineTotal = $unitPrice * $quantity;

                    $product = $this->resolveProduct($sku, $name, $unitPrice);

                    SaleItem::query()->firstOrCreate(
                        [
                            'sale_id' => $sale->id,
                            'product_id' => $product->id,
                            'name' => $name,
                            'quantity' => $quantity,
                        ],
                        [
                            'unit_price' => $unitPrice,
                            'unit_cost' => $product->cost,
                            'line_total' => $lineTotal,
                            'total_cost' => $product->cost * $quantity,
                            'gross_profit' => $lineTotal - ($product->cost * $quantity),
                        ]
                    );

                    $stats['items_created']++;
                }
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return $stats;
    }

    public function preview(string $path): array
    {
        return $this->import($path, true);
    }

    private function resolveProduct(string $sku, string $name, float $unitPrice): Product
    {
        $query = Product::query();

        if ($sku !== '') {
            $existing = $query->where('barcode', $sku)->first();
            if ($existing) {
                return $existing;
            }
        }

        $existing = Product::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
        if ($existing) {
            return $existing;
        }

        return Product::query()->create([
            'source_system' => 'historical_import',
            'source_external_id' => $sku !== '' ? $sku : $name,
            'source_payload' => [
                'name' => $name,
                'sku' => $sku,
                'origin' => 'historical_orders',
            ],
            'name' => $name,
            'barcode' => $sku !== '' ? $sku : uniqid('hist-'),
            'category' => 'Historico',
            'price' => $unitPrice,
            'cost' => 0,
            'stock' => 0,
            'is_active' => true,
        ]);
    }

    private function normalizeHeader(string $header): string
    {
        $header = preg_replace('/^\xEF\xBB\xBF/', '', trim($header)) ?? trim($header);
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $header);
        $normalized = strtolower($ascii !== false ? $ascii : $header);

        return preg_replace('/[^a-z0-9]+/', '', $normalized) ?? $normalized;
    }

    private function money(mixed $value): ?string
    {
        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        $text = str_replace(['$', ','], ['', ''], $text);

        return is_numeric($text) ? number_format((float) $text, 2, '.', '') : null;
    }

    private function mapStatus(string $sourceStatus): string
    {
        $normalized = mb_strtolower(trim($sourceStatus));

        return match (true) {
            str_contains($normalized, 'complet') => 'completed',
            str_contains($normalized, 'proces') || str_contains($normalized, 'espera') => 'on_hold',
            str_contains($normalized, 'pendient') || str_contains($normalized, 'pago') => 'pending_payment',
            str_contains($normalized, 'cancel') => 'cancelled',
            str_contains($normalized, 'reembols') || str_contains($normalized, 'refund') => 'refunded',
            default => 'other',
        };
    }

    private function buildNotes(string $orderNumber, string $sourceStatus, array $lines): string
    {
        $items = Collection::make($lines)->map(function (array $line) {
            $name = trim((string) ($line['nombredelarticulo'] ?? 'Producto historico'));
            $qty = max(1, (int) ($line['cantidadreembolso'] ?? $line['cantidad'] ?? 1));
            return "{$name} x{$qty}";
        })->implode(', ');

        return implode("\n", [
            "Pedido historico WooCommerce: {$orderNumber}",
            "Estado original: {$sourceStatus}",
            "Lineas: {$items}",
        ]);
    }
}
