<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Services\WooCommerceWordPressXmlImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WooCommerceWordPressXmlImporterTest extends TestCase
{
    use RefreshDatabase;

    public function test_importer_reads_wordpress_woocommerce_product_xml(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'wc-products-xml-');
        file_put_contents($path, <<<'XML'
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
    xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"
    xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
    <item>
        <title><![CDATA[TOALLITAS DESMAQUILLANTES B.C]]></title>
        <link>https://fabystudio.com/producto/toallitas/</link>
        <content:encoded><![CDATA[Descripcion larga]]></content:encoded>
        <excerpt:encoded><![CDATA[Descripcion corta]]></excerpt:encoded>
        <wp:post_id>15779</wp:post_id>
        <wp:status><![CDATA[publish]]></wp:status>
        <wp:post_name><![CDATA[toallitas]]></wp:post_name>
        <wp:post_type><![CDATA[product]]></wp:post_type>
        <category domain="product_cat" nicename="accessories"><![CDATA[Accessories]]></category>
        <wp:postmeta><wp:meta_key><![CDATA[_sku]]></wp:meta_key><wp:meta_value><![CDATA[683609866910]]></wp:meta_value></wp:postmeta>
        <wp:postmeta><wp:meta_key><![CDATA[_stock]]></wp:meta_key><wp:meta_value><![CDATA[6]]></wp:meta_value></wp:postmeta>
        <wp:postmeta><wp:meta_key><![CDATA[_regular_price]]></wp:meta_key><wp:meta_value><![CDATA[3500]]></wp:meta_value></wp:postmeta>
    </item>
</channel>
</rss>
XML);

        $stats = app(WooCommerceWordPressXmlImporter::class)->import($path);

        @unlink($path);

        $product = Product::query()->where('source_system', 'woocommerce_xml')->firstOrFail();

        $this->assertSame(1, $stats['processed']);
        $this->assertSame(1, $stats['created']);
        $this->assertSame('TOALLITAS DESMAQUILLANTES B.C', $product->name);
        $this->assertSame('683609866910', $product->barcode);
        $this->assertSame('3500.00', $product->price);
        $this->assertSame(6, $product->stock);
        $this->assertSame('Accessories', $product->category);
    }
}
