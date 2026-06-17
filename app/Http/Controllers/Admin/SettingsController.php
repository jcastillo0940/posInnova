<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Services\ExchangeRateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(): Response
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        return Inertia::render('Admin/Settings/Index', [
            'settings' => $this->settings(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        $data = $request->validate([
            'project_name' => ['required', 'string', 'max:120'],
            'company_name' => ['required', 'string', 'max:120'],
            'currency' => ['required', 'string', 'max:8'],
            'exchange_rate_usd_crc' => ['nullable', 'numeric', 'min:0.0001'],
            'tax_label' => ['required', 'string', 'max:50'],
            'tax_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'document_prefix' => ['required', 'string', 'max:20'],
            'gift_card_enabled' => ['boolean'],
            'sync_conflict_owner' => ['required', 'string', 'max:80'],
            'receipt_header' => ['nullable', 'string', 'max:255'],
            'receipt_footer' => ['nullable', 'string', 'max:255'],
            'auto_print_receipts' => ['boolean'],
        ]);

        foreach ($data as $key => $value) {
            SystemSetting::query()->updateOrCreate(['key' => $key], ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value]);
            cache()->forget("system-setting:$key");
        }

        return back()->with('status', 'Configuracion guardada');
    }

    public function syncExchangeRate(ExchangeRateService $exchangeRateService): RedirectResponse
    {
        abort_unless(auth()->user()?->isAdmin(), 403);

        $rate = $exchangeRateService->usdToCrc();

        abort_if($rate === null, 502, 'No se pudo consultar el tipo de cambio.');

        SystemSetting::query()->updateOrCreate(
            ['key' => 'exchange_rate_usd_crc'],
            ['value' => (string) $rate],
        );
        cache()->forget('system-setting:exchange_rate_usd_crc');

        return back()->with('status', 'Tipo de cambio actualizado.');
    }

    public static function value(string $key, mixed $default = null): mixed
    {
        return cache()->remember("system-setting:$key", 60, function () use ($key, $default) {
            return SystemSetting::query()->where('key', $key)->value('value') ?? $default;
        });
    }

    private function settings(): array
    {
        return [
            'project_name' => self::value('project_name', 'RetailFlow POS'),
            'company_name' => self::value('company_name', config('app.name')),
            'currency' => self::value('currency', 'CRC'),
            'exchange_rate_usd_crc' => self::value('exchange_rate_usd_crc', '0'),
            'tax_label' => self::value('tax_label', 'ITBMS'),
            'tax_rate' => self::value('tax_rate', '7'),
            'document_prefix' => self::value('document_prefix', 'VENTA'),
            'gift_card_enabled' => self::value('gift_card_enabled', '0') === '1',
            'sync_conflict_owner' => self::value('sync_conflict_owner', 'Administrador'),
            'receipt_header' => self::value('receipt_header', ''),
            'receipt_footer' => self::value('receipt_footer', ''),
            'auto_print_receipts' => self::value('auto_print_receipts', '0') === '1',
        ];
    }
}
