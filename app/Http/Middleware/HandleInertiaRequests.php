<?php

namespace App\Http\Middleware;

use App\Models\ApprovalRequest;
use App\Http\Controllers\Admin\SettingsController;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'credit_payment_ticket' => fn () => $request->session()->get('credit_payment_ticket'),
            ],
            'auth' => [
                'user' => $user,
                'permissions' => [
                    'accessPos' => (bool) $user,
                    'accessReports' => $user?->isAdmin() ?? false,
                    'accessProducts' => $user?->isAdmin() ?? false,
                    'accessCustomers' => (bool) $user,
                    'accessCash' => (bool) $user,
                    'manageCash' => $user?->canCloseCash() ?? false,
                    'manageSettings' => $user?->isAdmin() ?? false,
                    'manageUsers' => $user?->isSuperAdmin() ?? false,
                    'useSupervisorPin' => $user?->canBypassPin() ?? false,
                ],
            ],
            'approvals' => [
                'pendingCount' => fn () => $user && ($user->isAdmin() || $user->canBypassPin()) && Schema::hasTable('approval_requests')
                    ? ApprovalRequest::query()->where('status', 'pending')->count()
                    : 0,
            ],
            'money' => [
                'currency' => fn () => SettingsController::value('currency', 'CRC'),
                'exchangeRateUsdCrc' => fn () => (float) SettingsController::value('exchange_rate_usd_crc', '0'),
            ],
        ];
    }
}
