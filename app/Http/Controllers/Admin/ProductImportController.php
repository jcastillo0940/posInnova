<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\WooCommerceProductImporter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProductImportController extends Controller
{
    public function index(): Response
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        return Inertia::render('Admin/Products/Import', [
            'lastImport' => session('product_import_stats'),
        ]);
    }

    public function store(Request $request, WooCommerceProductImporter $importer): RedirectResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        $data = $request->validate([
            'csv' => ['required', 'file', 'mimes:csv,txt', 'max:20480'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        $path = $request->file('csv')->store('imports');
        $fullPath = Storage::path($path);

        $stats = $importer->import($fullPath, (bool) ($data['dry_run'] ?? false));

        Storage::delete($path);

        return back()->with('product_import_stats', $stats)->with('status', 'Importación completada');
    }
}
