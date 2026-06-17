<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
<style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111827; }
        h1 { font-size: 20px; margin: 0 0 10px; }
        h2 { font-size: 14px; margin: 18px 0 8px; }
        .muted { color: #6b7280; }
        .grid { width: 100%; border-collapse: collapse; }
        .grid td { padding: 6px 0; vertical-align: top; }
        .box { border: 1px solid #d1d5db; padding: 12px; margin-bottom: 12px; border-radius: 6px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .table th, .table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
        .table th { background: #f3f4f6; }
</style>
@php($decimals = ($settings['currency'] ?? 'CRC') === 'CRC' ? 0 : 2)
</head>
<body>
    <table class="grid">
        <tr>
            <td>
                <h1>{{ $settings['company_name'] ?? ($report['branch'] ?? 'Sucursal') }}</h1>
                <p class="muted">{{ $settings['project_name'] ?? 'RetailFlow POS' }}</p>
                @if(!empty($settings['receipt_header']))
                    <p class="muted">{{ $settings['receipt_header'] }}</p>
                @endif
                <p class="muted">{{ $report['cash_register'] ?? 'Caja' }}</p>
                <p class="muted">Folio {{ str_pad((string) $report['id'], 6, '0', STR_PAD_LEFT) }}</p>
                <p class="muted">Responsable apertura: {{ $report['opened_by_user'] ?? $report['opened_by'] ?? 'N/D' }}</p>
            </td>
            <td style="text-align: right">
                <h1>{{ $mode === 'x' ? 'Reporte X' : 'Reporte Z' }}</h1>
                <p class="muted">{{ now()->format('d/m/Y h:i a') }}</p>
                <p class="muted">Responsable cierre: {{ $report['closed_responsible_user'] ?? $report['closed_by'] ?? 'N/D' }}</p>
            </td>
        </tr>
    </table>

    <div class="box">
        <table class="grid">
            <tr><td><strong>Estado:</strong> {{ $report['status'] }}</td><td><strong>Ventas:</strong> {{ $report['sales_count'] }}</td></tr>
            <tr><td><strong>Apertura:</strong> {{ $report['opened_at'] }}</td><td><strong>Cierre:</strong> {{ $report['closed_at'] ?? 'N/D' }}</td></tr>
            <tr><td><strong>Total:</strong> {{ $settings['currency'] }} {{ number_format($report['total'], $decimals) }}</td><td><strong>Esperado:</strong> {{ $settings['currency'] }} {{ number_format($report['expected_cash'], $decimals) }}</td></tr>
            <tr><td><strong>Contado:</strong> {{ $report['counted_cash'] !== null ? $settings['currency'].' '.number_format($report['counted_cash'], $decimals) : 'Pendiente' }}</td><td><strong>Diferencia:</strong> {{ $settings['currency'] }} {{ number_format($report['cash_difference'], $decimals) }}</td></tr>
        </table>
    </div>

    <h2>Resumen operativo</h2>
    <table class="table">
        <tr><th>Subtotal</th><td>{{ $settings['currency'] }} {{ number_format($report['subtotal'], $decimals) }}</td></tr>
        <tr><th>Descuentos</th><td>{{ $settings['currency'] }} {{ number_format($report['discounts'], $decimals) }}</td></tr>
        <tr><th>Impuestos</th><td>{{ $settings['currency'] }} {{ number_format($report['tax'], $decimals) }}</td></tr>
        <tr><th>Efectivo neto</th><td>{{ $settings['currency'] }} {{ number_format($report['cash_sales'], $decimals) }}</td></tr>
        <tr><th>Cambio</th><td>{{ $settings['currency'] }} {{ number_format($report['change_total'], $decimals) }}</td></tr>
    </table>

    <h2>Denominaciones</h2>
    <table class="table">
        <tr><th>Denominacion</th><th>Cantidad</th><th>Monto</th></tr>
        @forelse($report['denominations'] as $row)
            <tr>
                <td>{{ $settings['currency'] }} {{ number_format($row['denomination'], $decimals) }}</td>
                <td>{{ $row['count'] }}</td>
                <td>{{ $settings['currency'] }} {{ number_format($row['amount'], $decimals) }}</td>
            </tr>
        @empty
            <tr><td colspan="3">Sin detalle de denominaciones.</td></tr>
        @endforelse
    </table>

    @if(!empty($report['notes']))
        <h2>Notas</h2>
        <p>{{ $report['notes'] }}</p>
    @endif

    @if(!empty($settings['receipt_footer']))
        <p class="muted">{{ $settings['receipt_footer'] }}</p>
    @endif
</body>
</html>
