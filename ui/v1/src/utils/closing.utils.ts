import type {Dayjs} from "dayjs";
import type {AccountDto, CategoryDto, ContractDto, MonthClosingDto, PersonDto} from "../gen/types.gen.ts";
import {EntryKindExpense} from "../gen/types.gen.ts";
import {amountInMonth, type Pot, potOf, summarizeMonth} from "./budget.utils.ts";

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
