import {
    BillingPeriodAnnually,
    BillingPeriodEveryTwoYears,
    BillingPeriodMonthly,
    BillingPeriodQuarterly, BillingPeriodSemiannual,
    BillingPeriodWeekly
} from "../gen/types.gen.ts";

function billingPeriodShorthand(period: string | undefined | null): string {
    if (!period) {
        return '';
    }

    switch (period) {
        case BillingPeriodWeekly:
            return 'Wk';
        case BillingPeriodMonthly:
            return 'Mth';
        case BillingPeriodQuarterly:
            return 'Qtr';
        case BillingPeriodSemiannual:
            return 'Semi-Ann.';
        case BillingPeriodAnnually:
            return 'Ann.';
        case BillingPeriodEveryTwoYears:
            return 'Biennial';
        default:
            return '';
    }
}

export {billingPeriodShorthand}
