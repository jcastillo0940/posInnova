<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

class WooCommerceWordPressXmlImporter
{
    public function import(string $path, bool $dryRun = false): array
    {
        libxml_use_internal_errors(true);

        $xml = simplexml_load_file($path);
        if ($xml === false) {
            throw new \RuntimeException('Unable to read WordPress XML export.');
        }

        $namespaces = $xml->getNamespaces(true);
        $wpNamespace = $namespaces['wp'] ?? 'http://wordpress.org/export/1.2/';
        $contentNamespace = $namespaces['content'] ?? 'http://purl.org/rss/1.0/modules/content/';
        $excerptNamespace = $namespaces['excerpt'] ?? 'http://wordpress.org/export/1.2/excerpt/';

        $stats = [
            'processed' => 0,
            'created' => 0,
            'updated' => 0,
            'skipped' => 0,
            'sample_products' => [],
        ];

        DB::beginTransaction();

        try {
            foreach ($xml->channel->item as $item) {
                $wp = $item->children($wpNamespace);
                $postType = trim((string) $wp->post_type);

                if ($postType !== 'product') {
                    continue;
                }

                $record = $this->mapProduct($item, $wpNamespace, $contentNamespace, $excerptNamespace);
                if ($record === null) {
                    $stats['skipped']++;
                    continue;
                }

                $stats['processed']++;

                if (count($stats['sample_products']) < 5) {
                    $stats['sample_products'][] = [
                        'name' => $record['name'],
                        'barcode' => $record['barcode'],
                        'category' => $record['category'],
                        'price' => (float) $record['price'],
                        'stock' => (int) $record['stock'],
                    ];
                }

                if ($dryRun) {
                    continue;
                }

                $existing = Product::query()
                    ->where('source_system', 'woocommerce_xml')
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
                    continue;
                }

                Product::query()->create($record);
                $stats['created']++;
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return $stats;
    }

    private function mapProduct(\SimpleXMLElement $item, string $wpNamespace, string $contentNamespace, string $excerptNamespace): ?array
    {
        $wp = $item->children($wpNamespace);
        $content = $item->children($contentNamespace);
        $excerpt = $item->children($excerptNamespace);
        $postId = trim((string) $wp->post_id);
        $name = trim((string) $item->title);

        if ($postId === '' || $name === '') {
            return null;
        }

        $meta = [];
        foreach ($wp->postmeta as $postMeta) {
            $key = trim((string) $postMeta->meta_key);
            if ($key === '') {
                continue;
            }

            $meta[$key] = trim((string) $postMeta->meta_value);
        }

        $sku = $this->cleanIdentifier($meta['_sku'] ?? '');
        $regularPrice = $this->money($meta['_regular_price'] ?? null);
        $salePrice = $this->money($meta['_sale_price'] ?? null);
        $price = $this->money($meta['_price'] ?? null);
        $stock = $this->integer($meta['_stock'] ?? 0);
        $lowStock = $this->integer($meta['_low_stock_amount'] ?? 0);

        return [
            'source_system' => 'woocommerce_xml',
            'source_external_id' => $postId,
            'source_payload' => [
                'post_id' => $postId,
                'post_name' => trim((string) $wp->post_name),
                'post_status' => trim((string) $wp->status),
                'link' => trim((string) $item->link),
                'meta' => $this->payloadMeta($meta),
            ],
            'name' => $name,
            'barcode' => $sku !== '' ? $sku : $postId,
            'category' => $this->categories($item),
            'description' => $this->nullableText((string) $content->encoded),
            'short_description' => $this->nullableText((string) $excerpt->encoded),
            'price' => $salePrice ?? $price ?? $regularPrice ?? '0.00',
            'cost' => 0,
            'stock' => $stock,
            'is_active' => trim((string) $wp->status) === 'publish',
            'variant' => null,
            'shade' => null,
            'size' => null,
            'lot_number' => null,
            'expires_at' => null,
            'min_stock' => $lowStock,
        ];
    }

    private function categories(\SimpleXMLElement $item): ?string
    {
        $categories = [];

        foreach ($item->category as $category) {
            $attributes = $category->attributes();
            if ((string) ($attributes['domain'] ?? '') !== 'product_cat') {
                continue;
            }

            $value = trim((string) $category);
            if ($value !== '') {
                $categories[] = $value;
            }
        }

        return $categories ? implode(' / ', array_values(array_unique($categories))) : null;
    }

    private function payloadMeta(array $meta): array
    {
        return array_intersect_key($meta, array_flip([
            '_sku',
            '_regular_price',
            '_sale_price',
            '_price',
            '_stock',
            '_stock_status',
            '_manage_stock',
            '_low_stock_amount',
            'total_sales',
        ]));
    }

    private function nullableText(string $value): ?string
    {
        $value = trim(strip_tags($value));

        return $value === '' ? null : $value;
    }

    private function money(mixed $value): ?string
    {
        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        $text = str_replace(['$', ','], ['', ''], $text);

        if (! is_numeric($text)) {
            return null;
        }

        $amount = (float) $text;

        // Reject negative or clearly corrupt values (> 99 million)
        if ($amount < 0 || $amount > 99_999_999.99) {
            return null;
        }

        return number_format($amount, 2, '.', '');
    }

    private function integer(mixed $value): int
    {
        $text = str_replace(',', '', trim((string) $value));

        return is_numeric($text) ? (int) $text : 0;
    }

    private function cleanIdentifier(mixed $value): string
    {
        $text = preg_replace("/^'+/", '', trim((string) $value)) ?? trim((string) $value);

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
