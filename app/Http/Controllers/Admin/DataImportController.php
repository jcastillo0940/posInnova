<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Sale;
use App\Services\HistoricalOrdersImporter;
use App\Services\WooCommerceProductImporter;
use App\Services\WooCommerceWordPressXmlImporter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DataImportController extends Controller
{
    public function index(): Response
    {
        abort_unless(auth()->user()?->isSuperAdmin(), 403);

        return Inertia::render('Admin/DataImports/Index', [
            'productImport' => session('product_import_stats'),
            'productXmlImport' => session('product_xml_import_stats'),
            'historicalImport' => session('historical_import_stats'),
        ]);
    }

    public function backup(): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        abort_unless(auth()->user()?->isSuperAdmin(), 403);

        $payload = [
            'generated_at' => now()->toIso8601String(),
            'counts' => [
                'products' => Product::count(),
                'sales' => Sale::count(),
            ],
            'products' => Product::query()
                ->orderBy('id')
                ->limit(1000)
                ->get(['id', 'name', 'barcode', 'category', 'price', 'cost', 'stock', 'is_active', 'updated_at'])
                ->toArray(),
            'sales' => Sale::query()
                ->with(['items:id,sale_id,product_id,name,quantity,unit_price,line_total'])
                ->orderBy('id')
                ->limit(500)
                ->get()
                ->toArray(),
        ];

        $filename = 'backup-before-import-' . now()->format('Y-m-d-His') . '.json';

        return response()->streamDownload(function () use ($payload) {
            echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }, $filename, [
            'Content-Type' => 'application/json',
        ]);
    }

    public function importProducts(Request $request, WooCommerceProductImporter $importer): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $data = $request->validate([
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:51200'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        $path = $request->file('csv')->store('imports');
        $fullPath = Storage::path($path);

        try {
            $stats = $importer->import($fullPath, (bool) ($data['dry_run'] ?? false));
        } finally {
            Storage::delete($path);
        }

        return back()
            ->with('product_import_stats', $stats)
            ->with('status', $data['dry_run'] ? 'Vista previa de productos completada.' : 'Importacion de productos completada.');
    }

    public function importProductsXml(Request $request, WooCommerceWordPressXmlImporter $importer): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $data = $request->validate([
            'xml' => ['required', 'file', 'mimes:xml,txt', 'max:51200'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        $path = $request->file('xml')->store('imports');
        $fullPath = Storage::path($path);

        try {
            $stats = $importer->import($fullPath, (bool) ($data['dry_run'] ?? false));
        } finally {
            Storage::delete($path);
        }

        return back()
            ->with('product_xml_import_stats', $stats)
            ->with('status', $data['dry_run'] ? 'Vista previa de productos XML completada.' : 'Importacion de productos XML completada.');
    }

    public function importHistorical(Request $request, HistoricalOrdersImporter $importer): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $data = $request->validate([
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:51200'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        $path = $request->file('csv')->store('imports');
        $fullPath = Storage::path($path);

        try {
            $stats = $data['dry_run']
                ? $importer->preview($fullPath)
                : $importer->import($fullPath, false);
        } finally {
            Storage::delete($path);
        }

        return back()
            ->with('historical_import_stats', $stats)
            ->with('status', $data['dry_run'] ? 'Vista previa del historico completada.' : 'Historico importado correctamente.');
    }
}
