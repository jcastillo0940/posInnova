<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class ExchangeRateService
{
    public function usdToCrc(): ?float
    {
        $response = Http::timeout(8)->get('https://open.er-api.com/v6/latest/USD');

        if (! $response->ok()) {
            return null;
        }

        $rate = data_get($response->json(), 'rates.CRC');

        return is_numeric($rate) ? (float) $rate : null;
    }
}
