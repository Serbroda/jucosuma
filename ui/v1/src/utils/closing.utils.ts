import type {Dayjs} from "dayjs";
import type {AccountDto, CategoryDto, ContractDto, MonthClosingDto, PersonDto} from "../gen/types.gen.ts";
import {EntryKindExpense} from "../gen/types.gen.ts";
import {amountInMonth, type Pot, potOf, summarizeMonth} from "./budget.utils.ts";
import dayjs from "../lib/dayjs";

export type PotComparison = {
    pot: Pot;
    planned: number;        // planned change of the pot's accounts in the month
    actual?: number;        // real change (end balance − balance at the end of the previous month)
    deviation?: number;     // actual − planned: negative means less money than planned
    accounts: number;       // accounts that could be compared
};

export type CategoryComparison = {
    category: CategoryDto;
    planned: number;
    actual: number;
    deviation: number;      // actual − planned: positive means spent more than planned
};

export type MonthComparison = {
    closing?: MonthClosingDto;
    previous?: MonthClosingDto;
    pots: PotComparison[];
    categories: CategoryComparison[];
};

const key = (m: Dayjs) => m.format("YYYY-MM");

/**
 * Compares plan and reality of a month. Balances need the closing of the month and of the month
 * before; only accounts with both balances are compared. Plans use the "due" mode because real
 * balances change when amounts are actually charged.
 */
export function compareMonth(
    month: Dayjs,
    closings: MonthClosingDto[],
    contracts: ContractDto[],
    persons: PersonDto[],
    accounts: AccountDto[],
    categories: CategoryDto[],
    mainCurrency: string,
): MonthComparison {
    const closing = closings.find((c) => c.month === key(month));
    const previous = closings.find((c) => c.month === key(month.subtract(1, "month")));
    const plan = summarizeMonth(contracts, persons, accounts, month, "due", mainCurrency, "all");
    const plannedByAccount = new Map(plan.accounts.map((f) => [f.account.id, f.inflow - f.outflow]));

    const pots: Pot[] = ["household", ...persons.filter((p) => p.in_household).map((p) => p.id)];
    const potComparisons = pots.map((pot): PotComparison => {
        const potAccounts = accounts.filter((a) => potOf(a) === pot);
        let planned = 0, actual = 0, compared = 0;
        for (const a of potAccounts) {
            const end = closing?.balances.find((b) => b.account_id === a.id);
            const start = previous?.balances.find((b) => b.account_id === a.id);
            if (end && start) {
                compared++;
                actual += end.balance - start.balance;
                planned += plannedByAccount.get(a.id) ?? 0;
            }
        }
        if (compared === 0) {
            planned = potAccounts.reduce((sum, a) => sum + (plannedByAccount.get(a.id) ?? 0), 0);
            return {pot, planned, accounts: 0};
        }
        return {pot, planned, actual, deviation: actual - planned, accounts: compared};
    }).filter((p) => accounts.some((a) => potOf(a) === p.pot));

    const categoryComparisons = (closing?.actuals ?? []).flatMap((a): CategoryComparison[] => {
        const category = categories.find((c) => c.id === a.category_id);
        if (!category) return [];
        const planned = plan.byCategory.find((c) => c.id === a.category_id)?.amount ?? 0;
        return [{category, planned, actual: a.amount, deviation: a.amount - planned}];
    }).sort((x, y) => y.deviation - x.deviation);

    return {closing, previous, pots: potComparisons, categories: categoryComparisons};
}

/**
 * Categories worth tracking in a closing: expense categories with planned non-contract costs in
 * the month (groceries, fuel, leisure …) plus categories tracked in earlier closings.
 */
export function variableCategories(
    month: Dayjs,
    closings: MonthClosingDto[],
    contracts: ContractDto[],
    categories: CategoryDto[],
): CategoryDto[] {
    const ids = new Set<number>();
    for (const c of contracts) {
        if (c.kind === EntryKindExpense && !c.is_contract && c.category_id != null && amountInMonth(c, month, "due") > 0) {
            ids.add(c.category_id);
        }
    }
    for (const closing of closings) for (const a of closing.actuals) ids.add(a.category_id);
    return categories.filter((c) => c.type === EntryKindExpense && ids.has(c.id));
}

export type CategoryTrend = {
    category: CategoryDto;
    months: number;              // months with an actual amount
    total: number;               // sum of actual amounts
    average: number;             // average actual per tracked month
    plan: number;                // current monthly plan (average mode)
    trend?: number;              // last 3 tracked months vs. the months before, as fraction (+0.12 = +12 %)
    recommendation: number;      // suggested monthly budget
};

export type VariableCostsYear = {
    months: { month: Dayjs; closed: boolean; values: Record<string, number>; planned: number }[];
    categories: CategoryTrend[];
    total: number;
    trackedMonths: number;
};

const RECENT = 3;

/**
 * Actual variable costs of the last 12 months (up to and including `endMonth`) per category, with
 * a trend and a suggested monthly budget. The suggestion is the average of the tracked months with
 * the last three weighted double, rounded up to 10, so it follows a rising or falling tendency
 * without overreacting to a single month.
 */
export function variableCostsYear(
    endMonth: Dayjs,
    closings: MonthClosingDto[],
    contracts: ContractDto[],
    persons: PersonDto[],
    accounts: AccountDto[],
    categories: CategoryDto[],
    mainCurrency: string,
): VariableCostsYear {
    const months = Array.from({length: 12}, (_, i) => endMonth.startOf("month").subtract(11 - i, "month")).map((m) => {
        const closing = closings.find((c) => c.month === m.format("YYYY-MM"));
        const values: Record<string, number> = {};
        for (const a of closing?.actuals ?? []) values[String(a.category_id)] = a.amount;
        return {month: m, closed: !!closing, values, planned: 0};
    });

    const currentPlan = summarizeMonth(contracts, persons, accounts, dayjs().startOf("month"), "average", mainCurrency, "all");
    const ids = new Set(months.flatMap((m) => Object.keys(m.values)));
    const trends = categories.filter((c) => ids.has(String(c.id))).map((category): CategoryTrend => {
        const series = months.map((m) => m.values[String(category.id)]).filter((v): v is number => v != null);
        const total = series.reduce((s, v) => s + v, 0);
        const average = series.length ? total / series.length : 0;
        const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
        const recent = series.slice(-RECENT);
        const earlier = series.slice(0, -RECENT);
        const trend = earlier.length > 0 && avg(earlier) > 0 ? avg(recent) / avg(earlier) - 1 : undefined;
        const weights = series.map((_, i) => (i >= series.length - RECENT ? 2 : 1));
        const weighted = series.reduce((s, v, i) => s + v * weights[i], 0) / weights.reduce((s, w) => s + w, 0);
        return {
            category,
            months: series.length,
            total,
            average,
            plan: currentPlan.byCategory.find((c) => c.id === category.id)?.amount ?? 0,
            trend,
            recommendation: Math.ceil(weighted / 10) * 10,
        };
    }).sort((a, b) => b.total - a.total);

    // planned amount per month (due in that month) for the tracked categories, to compare with the actuals
    const tracked = new Set(trends.map((c) => c.category.id));
    const withPlan = months.map((m) => ({
        ...m,
        planned: summarizeMonth(contracts, persons, accounts, m.month, "due", mainCurrency, "all").byCategory
            .filter((c) => c.id != null && tracked.has(c.id))
            .reduce((s, c) => s + c.amount, 0),
    }));

    return {
        months: withPlan,
        categories: trends,
        total: trends.reduce((s, c) => s + c.total, 0),
        trackedMonths: months.filter((m) => Object.keys(m.values).length > 0).length,
    };
}
