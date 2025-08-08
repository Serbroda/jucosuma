function range(size: number, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

function formatCurrency(value: number | undefined | null): string {
    if (!value) {
        return '';
    }

    const formatter = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
    });
    return formatter.format(value);
}


function formatDecimal(value: number | undefined | null): string {
    if (!value) {
        return '';
    }

    const formatter = new Intl.NumberFormat('de-DE', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return formatter.format(value);
}

export {range, formatCurrency, formatDecimal}
