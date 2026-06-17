export type CurrencyCode = 'CRC' | 'USD' | string;

export function moneyDecimals(currency: CurrencyCode) {
    return currency.toUpperCase() === 'CRC' ? 0 : 2;
}

export function currencySymbol(currency: CurrencyCode) {
    return currency.toUpperCase() === 'CRC' ? '₡' : '$';
}

export function formatMoney(amount: number | string | null | undefined, currency: CurrencyCode = 'CRC') {
    const value = Number(amount ?? 0);

    return `${currencySymbol(currency)}${value.toLocaleString('en-US', {
        minimumFractionDigits: moneyDecimals(currency),
        maximumFractionDigits: moneyDecimals(currency),
    })}`;
}

export function usdToCrc(amount: number | string, exchangeRateUsdCrc: number | string) {
    const rate = Number(exchangeRateUsdCrc || 0);

    if (rate <= 0) return 0;

    return Math.round(Number(amount || 0) * rate);
}
