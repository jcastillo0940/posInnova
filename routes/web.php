<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\CashSessionController;
use App\Http\Controllers\Admin\OperationsController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\OperationsActionController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\ProductImportController;
use App\Http\Controllers\Admin\PurchaseOrderController;
use App\Http\Controllers\Admin\ApprovalRequestController;
use App\Http\Controllers\Admin\SaleReversalController;
use App\Http\Controllers\PosSaleController;
use App\Http\Controllers\PosCreditPaymentController;
use App\Http\Controllers\SupervisorPinController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return auth()->check()
        ? to_route('dashboard')
        : to_route('login');
});

Route::get('/dashboard', DashboardController::class)->middleware(['auth'])->name('dashboard');
Route::post('/pos/sales', [PosSaleController::class, 'store'])->middleware(['auth'])->name('pos.sale.store');
Route::get('/pos/sales/{sale}/approval', [PosSaleController::class, 'approval'])->middleware(['auth'])->name('pos.sale.approval');
Route::post('/pos/sales/{sale}/finalize-approved', [PosSaleController::class, 'finalizeApproved'])->middleware(['auth'])->name('pos.sale.finalize-approved');
Route::get('/pos/customers/{customer}/pending-sales', [PosCreditPaymentController::class, 'pendingSales'])->middleware(['auth'])->name('pos.credit.pending-sales');
Route::post('/pos/credit-payments', [PosCreditPaymentController::class, 'store'])->middleware(['auth'])->name('pos.credit-payments.store');
Route::get('/pos/credit-payments/{creditTransaction}/ticket', [PosCreditPaymentController::class, 'ticket'])->middleware(['auth'])->name('pos.credit-payments.ticket');
Route::get('/pos/credit-payments/{creditTransaction}/ticket/pdf', [PosCreditPaymentController::class, 'ticketPdf'])->middleware(['auth'])->name('pos.credit-payments.ticket.pdf');
Route::post('/customers', [CustomerController::class, 'store'])->middleware(['auth'])->name('customers.store');

Route::middleware(['auth'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('/settings', [SettingsController::class, 'index'])->name('settings.index');
    Route::post('/settings', [SettingsController::class, 'update'])->name('settings.update');
    Route::post('/settings/exchange-rate/sync', [SettingsController::class, 'syncExchangeRate'])->name('settings.exchange-rate.sync');
    Route::get('/products/import', [ProductImportController::class, 'index'])->name('products.import.index');
    Route::post('/products/import', [ProductImportController::class, 'store'])->name('products.import.store');
    Route::get('/cash', [CashSessionController::class, 'index'])->name('cash.index');
    Route::post('/cash/open', [CashSessionController::class, 'open'])->middleware('supervisor.pin')->name('cash.open');
    Route::get('/cash/{cashSession}/x', [CashSessionController::class, 'xReport'])->name('cash.x');
    Route::get('/cash/{cashSession}/x/pdf', [CashSessionController::class, 'xPdf'])->name('cash.x.pdf');
    Route::get('/cash/{cashSession}/z', [CashSessionController::class, 'zReport'])->name('cash.z');
    Route::get('/cash/{cashSession}/z/pdf', [CashSessionController::class, 'zPdf'])->name('cash.z.pdf');
    Route::get('/cash/{cashSession}/ticket/pdf', [CashSessionController::class, 'ticketPdf'])->name('cash.ticket.pdf');
    Route::get('/cash/{cashSession}/ticket', [CashSessionController::class, 'ticket'])->name('cash.ticket');
    Route::post('/cash/{cashSession}/close', [CashSessionController::class, 'close'])->middleware('cash.close.pin')->name('cash.close');
    Route::get('/operations', [OperationsController::class, 'index'])->name('operations.index');
    Route::post('/operations/credit-accounts/{creditAccount}/payment', [OperationsActionController::class, 'creditPayment'])->name('operations.credit-accounts.payment');
    Route::post('/operations/layaways/{layaway}/payment', [OperationsActionController::class, 'layawayPayment'])->name('operations.layaways.payment');
    Route::post('/operations/returns/{return}/handle', [OperationsActionController::class, 'handleReturn'])->name('operations.returns.handle');
    Route::get('/inventory', [InventoryController::class, 'index'])->name('inventory.index');
    Route::get('/inventory/products', [InventoryController::class, 'products'])->name('inventory.products');
    Route::get('/inventory/purchases', [InventoryController::class, 'purchases'])->name('inventory.purchases');
    Route::get('/inventory/adjustments', [InventoryController::class, 'adjustments'])->name('inventory.adjustments');
    Route::post('/inventory/adjustments', [InventoryController::class, 'adjust'])->middleware('supervisor.pin')->name('inventory.adjust');
    Route::get('/inventory/counts', [InventoryController::class, 'counts'])->name('inventory.counts');
    Route::post('/inventory/counts', [InventoryController::class, 'count'])->middleware('supervisor.pin')->name('inventory.counts.store');
    Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
    Route::get('/approvals', [ApprovalRequestController::class, 'index'])->name('approvals.index');
    Route::post('/approvals/{approvalRequest}/approve', [ApprovalRequestController::class, 'approve'])->name('approvals.approve');
    Route::post('/approvals/{approvalRequest}/reject', [ApprovalRequestController::class, 'reject'])->name('approvals.reject');
    Route::post('/sales/{sale}/void', [SaleReversalController::class, 'store'])->middleware('supervisor.pin')->name('sales.void');
});

Route::middleware('auth')->prefix('supervisor')->name('supervisor.')->group(function () {
    Route::get('/pin', [SupervisorPinController::class, 'create'])->name('pin.form');
    Route::post('/pin', [SupervisorPinController::class, 'store'])->name('pin.store');
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
