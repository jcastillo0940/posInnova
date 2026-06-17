<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Services\WooCommerceProductImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WooCommerceProductImporterTest extends TestCase
{
    use RefreshDatabase;

    public function test_importer_ignores_barcode_like_values_as_prices_and_preserves_existing_price(): void
    {
        Product::create([
            'source_system' => 'woocommerce',
            'source_external_id' => '21257',
            'name' => 'SCULPT Y GLOW DUO STICK MOIRA 700',
            'barcode' => '21257',
            'category' => 'Accessories',
            'price' => 9500,
            'cost' => 0,
            'stock' => 1,
            'is_active' => true,
        ]);

        $path = tempnam(sys_get_temp_dir(), 'wc-import-');
        file_put_contents($path, implode("\n", [
            'ID,Tipo,SKU,Nombre,Publicado,Inventario,Precio rebajado,Precio normal,Categorías',
            '21257,simple,,"SCULPT Y GLOW DUO STICK MOIRA 700",1,6,,840222306876,Accessories',
            '99999,simple,,"Producto sin precio real",1,2,,840222306876,Accessories',
        ]));

        app(WooCommerceProductImporter::class)->import($path);

        @unlink($path);

        $existing = Product::query()->where('source_external_id', '21257')->firstOrFail();
        $created = Product::query()->where('source_external_id', '99999')->firstOrFail();

        $this->assertSame('9500.00', $existing->price);
        $this->assertSame('0.00', $created->price);
    }
}
