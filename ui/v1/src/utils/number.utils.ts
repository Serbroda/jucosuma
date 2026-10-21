import i18n from "../i18n";

/** Locale for number and currency formatting, derived from the UI language. */
function numberLocale(): string {
    return i18n.language === 'en' ? 'en-GB' : 'de-DE';
}

function range(size: number, startAt = 0) {
    return [...Array(size).keys()].map(i => i + startAt);
}

function formatCurrency(value: number | undefined | null, currency?: string): string {
    if (!value) {
        return '';
    }

    const formatter = new Intl.NumberFormat(numberLocale(), {
        style: 'currency',
        currency: currency || 'EUR',
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

/** Parses user input like "1.234,56", "23,99" or "23.99" into a number. */
function parseAmount(input: string | FormDataEntryValue | null | undefined): number | undefined {
    if (!input) {
        return undefined;
    }
    let value = input.toString().replace(/[^0-9,.-]/g, "");
    if (value.includes(",")) {
        // German notation: dots are thousands separators
        value = value.replace(/\./g, "").replace(/,/g, ".");
    }
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
}

export {range, formatCurrency, formatDecimal, parseAmount, numberLocale}
