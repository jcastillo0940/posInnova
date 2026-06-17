<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        @page { margin: 4mm; }
        body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9px; margin: 0; }
        .ticket { width: 72mm; padding: 0; }
        .center { text-align: center; }
        .muted { color: #666; font-size: 8px; }
        .section { border-top: 1px dashed #999; margin-top: 6px; padding-top: 6px; }
        .row { display: flex; justify-content: space-between; gap: 8px; margin: 1px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1px 0; vertical-align: top; }
        .bold { font-weight: 700; }
    </style>
</head>
<body>
<div class="ticket">
    <div class="center">
        <div class="bold">{{ $settings['company_name'] }}</div>
        <div class="muted">COMPROBANTE DE ABONO</div>
    </div>

    <div class="section">
        <div class="row"><span>Abono #</span><span>{{ $transaction['id'] }}</span></div>
        <div class="row"><span>Fecha</span><span>{{ $transaction['created_at'] }}</span></div>
        <div class="row"><span>Cliente</span><span>{{ $transaction['customer']['name'] ?? 'Cliente' }}</span></div>
    </div>

    <div class="section">
        <div class="bold">FACTURAS APLICADAS</div>
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
        <div class="row"><span>Total abonado</span><span class="bold">CRC {{ number_format($transaction['amount'], 0, ',', '.') }}</span></div>
    </div>
</div>
</body>
</html>
