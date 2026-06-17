<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #111827; margin: 0; padding: 0; }
        .ticket { width: 210px; padding: 10px; }
        .center { text-align: center; }
        .muted { color: #6b7280; }
        .line { border-top: 1px dashed #9ca3af; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .right { text-align: right; }
</style>
@php($decimals = ($settings['currency'] ?? 'CRC') === 'CRC' ? 0 : 2)
</head>
<body>
    <div class="ticket">
        <div class="center">
            <strong>{{ $settings['company_name'] ?? 'Sucursal' }}</strong><br>
            <span>{{ $settings['project_name'] ?? 'Caja' }}</span><br>
            @if(!empty($settings['receipt_header']))
                <span class="muted">{{ $settings['receipt_header'] }}</span><br>
            @endif
            <strong>{{ $report['branch'] ?? 'Sucursal' }}</strong><br>
            <span>{{ $report['cash_register'] ?? 'Caja' }}</span><br>
            <span class="muted">Folio {{ str_pad((string) $report['id'], 6, '0', STR_PAD_LEFT) }}</span>
        </div>

        <div class="line"></div>

        <table>
            <tr><td>Estado</td><td class="right">{{ $report['status'] }}</td></tr>
            <tr><td>Apertura</td><td class="right">{{ $report['opened_at'] }}</td></tr>
            <tr><td>Cierre</td><td class="right">{{ $report['closed_at'] ?? 'N/D' }}</td></tr>
            <tr><td>Ventas</td><td class="right">{{ $report['sales_count'] }}</td></tr>
            <tr><td>Total</td><td class="right">{{ $settings['currency'] }} {{ number_format($report['total'], $decimals) }}</td></tr>
            <tr><td>Esperado</td><td class="right">{{ $settings['currency'] }} {{ number_format($report['expected_cash'], $decimals) }}</td></tr>
            <tr><td>Contado</td><td class="right">{{ $report['counted_cash'] !== null ? $settings['currency'].' '.number_format($report['counted_cash'], $decimals) : 'Pendiente' }}</td></tr>
            <tr><td>Diferencia</td><td class="right">{{ $settings['currency'] }} {{ number_format($report['cash_difference'], $decimals) }}</td></tr>
        </table>

        <div class="line"></div>

        <div class="center muted">Imprimible al cierre</div>
        @if(!empty($settings['receipt_footer']))
            <div class="center muted">{{ $settings['receipt_footer'] }}</div>
        @endif
    </div>
</body>
</html>
