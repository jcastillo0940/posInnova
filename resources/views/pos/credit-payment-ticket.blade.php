<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket Abono</title>
    <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: Arial, sans-serif; margin: 0; background: #fff; }
        .ticket { width: 72mm; margin: 0 auto; padding: 0; color: #111; }
        .center { text-align: center; }
        .muted { color: #666; font-size: 10px; line-height: 1.2; }
        .row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin: 2px 0; }
        .section { border-top: 1px dashed #bbb; margin-top: 8px; padding-top: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        td { padding: 2px 0; vertical-align: top; }
        .bold { font-weight: 700; }
        .total { font-size: 13px; font-weight: 700; }
        .mono { font-variant-numeric: tabular-nums; }
        @media print { body { background: #fff; } .ticket { width: 72mm; } }
    </style>
</head>
<body onload="window.print()">
<div class="ticket">
    <div class="center">
        <div class="bold">{{ $settings['company_name'] }}</div>
        <div class="muted">COMPROBANTE DE ABONO</div>
    </div>

    <div class="section">
        <div class="row mono"><span>Abono #</span><span>{{ $transaction['id'] }}</span></div>
        <div class="row mono"><span>Fecha</span><span>{{ $transaction['created_at'] }}</span></div>
        <div class="row"><span>Cliente</span><span>{{ $transaction['customer']['name'] ?? 'Cliente' }}</span></div>
        <div class="row"><span>Cedula</span><span>{{ $transaction['customer']['document'] ?? '-' }}</span></div>
        <div class="row"><span>Cajero</span><span>{{ $transaction['user'] ?? '-' }}</span></div>
    </div>

    <div class="section">
        <div class="bold" style="margin-bottom: 4px;">FACTURAS APLICADAS</div>
        <table>
            @foreach($transaction['allocations'] as $allocation)
                <tr>
                    <td>{{ $allocation['sale_number'] }}</td>
                    <td style="text-align:right;">CRC {{ number_format($allocation['amount'], 0, ',', '.') }}</td>
                </tr>
            @endforeach
        </table>
    </div>

    <div class="section">
        <div class="row total"><span>Total abonado</span><span>CRC {{ number_format($transaction['amount'], 0, ',', '.') }}</span></div>
    </div>

    @if(!empty($settings['receipt_footer']))
        <div class="section center muted">{{ $settings['receipt_footer'] }}</div>
    @endif
</div>
</body>
</html>
