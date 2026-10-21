import type {Dayjs} from "dayjs";
import dayjs from "../lib/dayjs";
import {
    BillingPeriodAnnually,
    BillingPeriodEveryTwoYears,
    BillingPeriodMonthly,
    BillingPeriodNone,
    BillingPeriodOneTime,
    BillingPeriodQuarterly,
    BillingPeriodSemiannual,
    BillingPeriodWeekly,
    EntryKindExpense,
    EntryKindIncome,
    EntryKindTransfer,
    type AccountDto,
    type ContractDto,
    type PersonDto,
    type SavingsGoalDto,
} from "../gen/types.gen.ts";
import {categoryLabel} from "./household.utils.ts";

/**
 * average: recurring amounts are spread evenly over the months (annual costs / 12).
 * due: amounts are counted in the month in which they are actually charged.
 */
export type MonthMode = "average" | "due";

const periodInMonths: Record<string, number> = {
    [BillingPeriodMonthly]: 1,
    [BillingPeriodQuarterly]: 3,
    [BillingPeriodSemiannual]: 6,
    [BillingPeriodAnnually]: 12,
    [BillingPeriodEveryTwoYears]: 24,
};

/** Accounts flagged as savings (any type, e.g. a checking account used as buffer). */
export function isSavingsAccount(account: AccountDto | undefined): boolean {
    return account?.is_savings ?? false;
}

/** Number of charges of an entry that fall into the given month. */
function occurrencesInMonth(c: ContractDto, month: Dayjs): number {
    const start = dayjs(c.start_date).startOf("day");
    const end = c.end_date ? dayjs(c.end_date).startOf("day") : null;
    const monthStart = month.startOf("month");
    const monthEnd = month.endOf("month");
    const inRange = (d: Dayjs) =>
        !d.isBefore(monthStart) && !d.isAfter(monthEnd) && !d.isBefore(start) && (!end || !d.isAfter(end));

    if (c.billing_period === BillingPeriodOneTime) {
        return inRange(start) ? 1 : 0;
    }

    if (c.billing_period === BillingPeriodWeekly) {
        let count = 0;
        const weeksToMonth = Math.max(0, Math.floor(monthStart.diff(start, "day") / 7));
        for (let d = start.add(weeksToMonth * 7, "day"); !d.isAfter(monthEnd); d = d.add(7, "day")) {
            if (inRange(d)) count++;
        }
        return count;
    }

    const period = periodInMonths[c.billing_period];
    if (!period) return 0;
    const diff = monthStart.diff(start.startOf("month"), "month");
    if (diff < 0 || diff % period !== 0) return 0;
    return inRange(start.add(diff, "month")) ? 1 : 0;
}

function isActiveInMonth(c: ContractDto, month: Dayjs): boolean {
    const start = dayjs(c.start_date);
    const end = c.end_date ? dayjs(c.end_date) : null;
    return !start.isAfter(month.endOf("month"), "day") && (!end || !end.isBefore(month.startOf("month"), "day"));
}

/** Full amount of an entry in the given month (before applying cost shares). */
export function amountInMonth(c: ContractDto, month: Dayjs, mode: MonthMode): number {
    if (!c.costs || c.billing_period === BillingPeriodNone) return 0;
    if (c.billing_period === BillingPeriodOneTime || mode === "due") {
        return c.costs * occurrencesInMonth(c, month);
    }
    return isActiveInMonth(c, month) ? (c.monthly_amount ?? 0) : 0;
}

/**
 * Fraction of an entry attributed to each person.
 * Explicit shares win; otherwise the owner of the relevant account (target account for transfers)
 * gets everything. Returns null for shared entries that are not split.
 */
export function attribution(c: ContractDto, persons: PersonDto[], accounts: AccountDto[]): Map<number, number> | null {
    const known = c.shares.filter((s) => persons.some((p) => p.id === s.person_id));
    const total = known.reduce((sum, s) => sum + s.weight, 0);
    if (c.kind !== EntryKindTransfer && total > 0) {
        return new Map(known.map((s) => [s.person_id, s.weight / total]));
    }
    const accountId = c.kind === EntryKindTransfer ? c.target_account_id : c.account_id;
    const owner = accounts.find((a) => a.id === accountId)?.person_id;
    return owner != null ? new Map([[owner, 1]]) : null;
}

/**
 * Who an expense belongs to: a single household member ("private" cost) or the household
 * (several members, or a shared account without explicit split). External persons never count.
 */
export function costOwner(c: ContractDto, persons: PersonDto[], accounts: AccountDto[]): number | "household" {
    const parts = attribution(c, persons, accounts);
    if (!parts) return "household";
    const members = [...parts.entries()]
        .filter(([id, f]) => f > 0 && persons.some((p) => p.id === id && p.in_household))
        .map(([id]) => id);
    return members.length === 1 ? members[0] : "household";
}

export type AccountFlow = { account: AccountDto; inflow: number; outflow: number };
export type PersonalBudget = { person: PersonDto; budget: number; spent: number };

export type MonthEntry = {
    entry: ContractDto;
    amount: number; // full amount in the month
    own: number;    // part that counts for the selected scope (household or person)
};

export type MonthSummary = {
    income: number;
    expenses: number;          // household's (or the person's) share of expenses
    externalShare: number;     // part of expenses borne by external persons (household scope only)
    savings: number;           // transfers to savings / depot accounts
    freeBudgets: number;       // pocket money not planned for costs (household scope only)
    unallocated: number;
    byCategory: { id?: number; name: string; label: string; amount: number }[];
    householdCosts: number;    // costs belonging to the household as a whole
    privateCosts: Record<number, number>; // private costs per household member
    accounts: AccountFlow[];
    budgets: PersonalBudget[];
    entries: MonthEntry[];
    unassignedAccount: number; // number of entries in this month without account
};

/**
 * Summarizes a month for the whole household or, with `personId`, for one household member.
 * In the personal scope unsplit shared entries are divided equally among household members.
 */
export function summarizeMonth(
    contracts: ContractDto[],
    persons: PersonDto[],
    accounts: AccountDto[],
    month: Dayjs,
    mode: MonthMode,
    mainCurrency: string,
    personId?: number,
): MonthSummary {
    const personal = personId != null;
    const householdSize = Math.max(1, persons.filter((p) => p.in_household).length);
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const flows = new Map<number, AccountFlow>(
        accounts
            .filter((a) => !personal || a.person_id === personId)
            .map((a) => [a.id, {account: a, inflow: 0, outflow: 0}]),
    );
    const byCategory = new Map<string, { id?: number; name: string; label: string; amount: number }>();
    let householdCosts = 0;
    const privateCosts: Record<number, number> = {};
    const budgets = new Map<number, PersonalBudget>(
        persons.filter((p) => p.in_household && (!personal || p.id === personId))
            .map((p) => [p.id, {person: p, budget: 0, spent: 0}]),
    );
    const entries: MonthEntry[] = [];

    let income = 0, expenses = 0, externalShare = 0, savings = 0, unassignedAccount = 0;

    // Fraction of an entry that counts for the selected scope.
    const scopeFraction = (c: ContractDto): number => {
        if (!personal) return c.kind === EntryKindExpense ? c.household_share : 1;
        const parts = attribution(c, persons, accounts);
        return parts ? parts.get(personId) ?? 0 : 1 / householdSize;
    };

    for (const c of contracts) {
        if (c.currency && c.currency !== mainCurrency) continue;
        const amount = amountInMonth(c, month, mode);
        if (amount === 0) continue;

        const account = c.account_id != null ? accountById.get(c.account_id) : undefined;
        const target = c.target_account_id != null ? accountById.get(c.target_account_id) : undefined;
        // transfers into a savings goal or a savings account (from a non-savings account) are savings
        const isSaving = c.kind === EntryKindTransfer && !isSavingsAccount(account)
            && (c.goal_id != null || isSavingsAccount(target));
        const own = c.kind === EntryKindTransfer && !isSaving
            ? (personal ? (target?.person_id === personId ? amount : 0) : amount)
            : amount * scopeFraction(c);

        const from = account && flows.get(account.id);
        const to = target && flows.get(target.id);
        if (personal && own === 0 && !from && !to) continue;

        entries.push({entry: c, amount, own});
        if (!account) unassignedAccount++;

        if (c.kind === EntryKindIncome) {
            income += own;
            if (from) from.inflow += amount;
        } else if (c.kind === EntryKindTransfer) {
            if (from) from.outflow += amount;
            if (to) to.inflow += amount;
            if (isSaving) {
                savings += own;
            } else if (target?.person_id != null) {
                const budget = budgets.get(target.person_id);
                if (budget) budget.budget += amount;
            }
        } else if (c.kind === EntryKindExpense) {
            const household = amount * c.household_share;
            expenses += own;
            if (!personal) externalShare += amount - household;
            const groupKey = c.category_id != null ? String(c.category_id) : c.category;
            const cat = byCategory.get(groupKey)
                ?? {id: c.category_id, name: c.category, label: categoryLabel(c.category, c.category_key), amount: 0};
            cat.amount += own;
            byCategory.set(groupKey, cat);

            const owner = costOwner(c, persons, accounts);
            if (owner === "household") householdCosts += own;
            else privateCosts[owner] = (privateCosts[owner] ?? 0) + own;

            if (from) from.outflow += household;
            if (account?.person_id != null) {
                const budget = budgets.get(account.person_id);
                if (budget) budget.spent += household;
            }
        }
    }

    // only persons who actually get pocket money have a budget
    const budgetList = [...budgets.values()].filter((b) => b.budget > 0);
    // Pocket money is allocated to persons; only its unplanned part is set aside here
    // (costs paid from it are already part of the expenses).
    const freeBudgets = personal ? 0 : budgetList.reduce((sum, b) => sum + Math.max(0, b.budget - b.spent), 0);

    return {
        income,
        expenses,
        externalShare,
        savings,
        freeBudgets,
        unallocated: income - expenses - savings - freeBudgets,
        byCategory: [...byCategory.values()].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount),
        householdCosts,
        privateCosts,
        accounts: [...flows.values()].filter((f) => f.inflow !== 0 || f.outflow !== 0),
        budgets: budgetList,
        entries: entries.sort((a, b) => b.own - a.own),
        unassignedAccount,
    };
}

export type GoalSummary = {
    goal: SavingsGoalDto;
    monthlyRate: number;     // recurring transfers into the goal
    current: number;         // last entered amount plus planned transfers since then
    progress?: number;       // 0..1
    reachedOn?: Dayjs;       // at the current rate
    requiredRate?: number;   // to reach the target by its date
    transfers: ContractDto[];
};

/** Savings goals with their monthly rate, estimated amount and projection, as of `today`. */
export function summarizeGoals(contracts: ContractDto[], goals: SavingsGoalDto[], today: Dayjs = dayjs()): GoalSummary[] {
    const month = today.startOf("month");
    return goals.map((goal) => {
        const transfers = contracts.filter((c) => c.kind === EntryKindTransfer && c.goal_id === goal.id);
        const monthlyRate = transfers
            .filter((c) => c.billing_period !== BillingPeriodOneTime)
            .reduce((sum, c) => sum + amountInMonth(c, month, "average"), 0);

        const since = goal.current_date ? dayjs(goal.current_date).startOf("month") : month;
        const elapsed = Math.max(0, month.diff(since, "month"));
        const current = (goal.current_amount ?? 0) + monthlyRate * elapsed;

        const result: GoalSummary = {goal, monthlyRate, current, transfers};
        const target = goal.target_amount;
        if (target != null && target > 0) {
            const missing = target - current;
            result.progress = Math.min(1, Math.max(0, current / target));
            if (missing > 0 && monthlyRate > 0) {
                result.reachedOn = month.add(Math.ceil(missing / monthlyRate), "month");
            }
            if (goal.target_date && missing > 0) {
                const months = Math.max(1, dayjs(goal.target_date).startOf("month").diff(month, "month"));
                result.requiredRate = missing / months;
            }
        }
        return result;
    });
}

/**
 * Readable assignment of an expense: "Household", a person's name, or percentages when the split
 * is uneven or external persons take part (e.g. "Household 25 % · Friends 75 %").
 */
export function splitText(c: ContractDto, persons: PersonDto[], accounts: AccountDto[], householdLabel: string, locale: string): string {
    const parts = attribution(c, persons, accounts);
    if (!parts) return householdLabel;
    const percent = (f: number) => `${(Math.round(f * 1000) / 10).toLocaleString(locale)} %`;
    const isMember = (id: number) => persons.some((p) => p.id === id && p.in_household);
    const members = [...parts.entries()].filter(([id, f]) => f > 0 && isMember(id));
    const externals = [...parts.entries()].filter(([id, f]) => f > 0 && !isMember(id));
    const name = (id: number) => persons.find((p) => p.id === id)?.name ?? "?";
    const householdSize = persons.filter((p) => p.in_household).length;
    const equal = members.every(([, f]) => Math.abs(f - members[0][1]) < 1e-9);

    let head: string[];
    if (members.length === householdSize && householdSize > 1 && equal) {
        const share = members.reduce((s, [, f]) => s + f, 0);
        head = [externals.length ? `${householdLabel} ${percent(share)}` : householdLabel];
    } else if (members.length === 1 && externals.length === 0) {
        return name(members[0][0]);
    } else {
        head = members.map(([id, f]) => `${name(id)} ${percent(f)}`);
    }
    return [...head, ...externals.map(([id, f]) => `${name(id)} ${percent(f)}`)].join(" · ");
}
