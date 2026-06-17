<?php

namespace App\Support;

class Money
{
    public static function decimals(string $currency): int
    {
        return strtoupper($currency) === 'CRC' ? 0 : 2;
    }

    public static function format(float|int|string $amount, string $currency): string
    {
        $decimals = self::decimals($currency);

        return number_format((float) $amount, $decimals, '.', ',');
    }

    public static function crcToUsd(float|int|string $amount, float|int|string $rate): float
    {
        $rate = (float) $rate;

        if ($rate <= 0) {
            return 0.0;
        }

        return round(((float) $amount) / $rate, 2);
    }

    public static function usdToCrc(float|int|string $amount, float|int|string $rate): float
    {
        return round(((float) $amount) * (float) $rate, 0);
    }
}
