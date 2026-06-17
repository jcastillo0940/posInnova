<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class WooCommerceProductImporter
{
    public function import(string $path, bool $dryRun = false): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open CSV file.');
        }

        $headers = fgetcsv($handle);
        if (!is_array($headers)) {
            fclose($handle);
            throw new \RuntimeException('CSV appears to be empty.');
        }

        $headers = array_map([$this, 'normalizeHeader'], $headers);
        $stats = ['processed' => 0, 'created' => 0, 'updated' => 0, 'skipped' => 0];

        DB::beginTransaction();
        try {
            while (($row = fgetcsv($handle)) !== false) {
                if ($row === [null] || count(array_filter($row, fn ($value) => $value !== null && $value !== '')) === 0) {
                    continue;
                }

                $assoc = array_combine($headers, array_pad($row, count($headers), null));
                if (!is_array($assoc)) {
                    $stats['skipped']++;
                    continue;
                }

                $record = $this->mapRow($assoc);
                $stats['processed']++;

                if ($dryRun) {
                    continue;
                }

                $existing = Product::query()
                    ->where('source_system', 'woocommerce')
                    ->where('source_external_id', $record['source_external_id'])
                    ->first();

                $barcodeTaken = Product::query()
                    ->where('barcode', $record['barcode'])
                    ->when($existing, fn ($query) => $query->whereKeyNot($existing->getKey()))
                    ->exists();

                if ($barcodeTaken) {
                    $record['barcode'] = $this->makeUniqueBarcode($record['barcode'], $record['source_external_id'], $existing?->getKey());
                }

                if ($existing) {
                    if ((float) $record['price'] <= 0 && (float) $existing->price > 0) {
                        $record['price'] = $existing->price;
                    }

                    $existing->update($record);
                    $stats['updated']++;
                } else {
                    Product::query()->create($record);
                    $stats['created']++;
                }
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            fclose($handle);
            throw $e;
        }

        fclose($handle);

        return $stats;
    }

    private function mapRow(array $row): array
    {
        $id = $this->cleanScalar($row['id'] ?? '');
        $sku = $this->cleanIdentifier($row['sku'] ?? '');
        $name = $this->cleanScalar($row['nombre'] ?? '');
        $stock = $this->integer($row['inventario'] ?? 0);
        $lowStock = $this->integer($row['cantidaddebajoinventario'] ?? 0);
        $regular = $this->money($row['precionormal'] ?? null);
        $sale = $this->money($row['preciorebajado'] ?? null);

        return [
            'source_system' => 'woocommerce',
            'source_external_id' => $id !== '' ? $id : ($sku !== '' ? $sku : $name),
            'source_payload' => Arr::except($row, []),
            'name' => $name !== '' ? $name : ($sku !== '' ? $sku : 'Producto importado'),
            'barcode' => $sku !== '' ? $sku : ($id !== '' ? $id : uniqid('wc-')),
            'category' => $this->normalizeCategories($row['categorias'] ?? null),
            'description' => $this->normalizeText($row['descripcion'] ?? null),
            'short_description' => $this->normalizeText($row['descripcioncorta'] ?? null),
            'price' => $sale ?? $regular ?? 0,
            'cost' => 0,
            'stock' => $stock,
            'is_active' => true,
            'min_stock' => $lowStock > 0 ? $lowStock : 0,
            'variant' => $this->normalizeText($row['superior'] ?? null),
            'shade' => null,
            'size' => null,
            'lot_number' => null,
            'expires_at' => null,
        ];
    }

    private function normalizeHeader(string $header): string
    {
        $header = preg_replace('/^\xEF\xBB\xBF/', '', trim($header)) ?? trim($header);
        $header = str_replace(['¿', '?'], '', $header);
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $header);
        $normalized = strtolower($ascii !== false ? $ascii : $header);

        return preg_replace('/[^a-z0-9]+/', '', $normalized) ?? $normalized;
    }

    private function normalizeText(mixed $value): ?string
    {
        $text = $this->cleanScalar($value);

        return $text === '' ? null : $text;
    }

    private function normalizeCategories(mixed $value): ?string
    {
        $text = $this->cleanScalar($value);
        if ($text === '') {
            return null;
        }

        $parts = array_values(array_filter(array_map('trim', explode(',', $text))));

        return $parts ? implode(' / ', array_unique($parts)) : null;
    }

    private function money(mixed $value): ?string
    {
        $text = $this->cleanScalar($value);
        if ($text === '') {
            return null;
        }

        $text = str_replace(['$', ','], ['', ''], $text);

        if (! is_numeric($text) || $this->looksLikeBarcode($text)) {
            return null;
        }

        return number_format((float) $text, 2, '.', '');
    }

    private function looksLikeBarcode(string $value): bool
    {
        $digits = preg_replace('/\D+/', '', $value) ?? '';

        return $digits === $value && strlen($digits) >= 8 && (float) $digits > 1000000;
    }

    private function integer(mixed $value): int
    {
        $text = $this->cleanScalar($value);
        if ($text === '') {
            return 0;
        }

        $text = str_replace(',', '', $text);

        return is_numeric($text) ? (int) $text : 0;
    }

    private function cleanScalar(mixed $value): string
    {
        $text = trim((string) $value);

        return preg_replace("/^'+/", '', $text) ?? $text;
    }

    private function cleanIdentifier(mixed $value): string
    {
        $text = $this->cleanScalar($value);

        if (preg_match('/^-\d+$/', $text) === 1) {
            return ltrim($text, '-');
        }

        return $text;
    }

    private function makeUniqueBarcode(string $barcode, string $sourceExternalId, ?int $currentProductId = null): string
    {
        $candidate = "{$barcode}-{$sourceExternalId}";
        $suffix = 2;

        while (Product::query()
            ->where('barcode', $candidate)
            ->when($currentProductId, fn ($query) => $query->whereKeyNot($currentProductId))
            ->exists()) {
            $candidate = "{$barcode}-{$sourceExternalId}-{$suffix}";
            $suffix++;
        }

        return $candidate;
    }
}
