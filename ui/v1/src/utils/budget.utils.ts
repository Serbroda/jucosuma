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
    TransferTypeMove,
    TransferTypeSaving,
    TransferTypeWithdrawal,
    type AccountDto,
    type ContractDto,
    type PersonDto,
    type SavingsGoalDto,
    type ShareDto,
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

/**
 * Suggested type of a transfer: into a savings goal or savings account from regular money is saving,
 * from a savings account back to a regular account a withdrawal, everything else only moves money.
 */
export function defaultTransferType(from: AccountDto | undefined, to: AccountDto | undefined, goalId?: number | null): string {
    if (isSavingsAccount(from)) return isSavingsAccount(to) ? TransferTypeMove : TransferTypeWithdrawal;
    return goalId != null || isSavingsAccount(to) ? TransferTypeSaving : TransferTypeMove;
}

/** Type of a transfer: as chosen, for older entries without one derived from the accounts. */
export function transferTypeOf(c: ContractDto, accountById: Map<number, AccountDto>): string {
    return c.transfer_type || defaultTransferType(accountById.get(c.account_id ?? -1), accountById.get(c.target_account_id ?? -1), c.goal_id);
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

/**
 * Amount of a single payment valid at a date. Amount changes apply from the month that contains
 * their date on, so a change "from 15 May" already counts for May.
 */
export function costsAt(c: ContractDto, date: Dayjs): number | undefined {
    let costs = c.base_costs ?? c.costs;
    for (const a of c.amounts ?? []) {
        if (!dayjs(a.valid_from).isAfter(date.endOf("month"), "day")) costs = a.costs;
    }
    return costs;
}

/** Factor from one payment to its average per month. */
function monthlyFactor(period: string): number {
    if (period === BillingPeriodWeekly) return 52 / 12;
    const months = periodInMonths[period];
    return months ? 1 / months : 0;
}

/** Full amount of an entry in the given month (before applying cost shares). */
export function amountInMonth(c: ContractDto, month: Dayjs, mode: MonthMode): number {
    if (c.billing_period === BillingPeriodNone) return 0;
    const costs = costsAt(c, month);
    if (!costs) return 0;
    if (c.billing_period === BillingPeriodOneTime || mode === "due") {
        return costs * occurrencesInMonth(c, month);
    }
    return isActiveInMonth(c, month) ? costs * monthlyFactor(c.billing_period) : 0;
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

/** Filter of a table by assignment: everything, shared entries ("household") or one member's entries. */
export type OwnerFilter = "all" | Pot;

/** Whether an entry passes the assignment filter; a transfer passes for the pots on both of its sides. */
export function matchesOwner(c: ContractDto, filter: OwnerFilter, persons: PersonDto[], accounts: AccountDto[]): boolean {
    if (filter === "all") return true;
    if (c.kind === EntryKindTransfer) {
        const pot = (id: number | undefined) => potOf(accounts.find((a) => a.id === id));
        return pot(c.account_id) === filter || pot(c.target_account_id) === filter;
    }
    return costOwner(c, persons, accounts) === filter;
}

export type AccountFlow = { account: AccountDto; inflow: number; outflow: number };

/**
 * A pot of money: the household (all shared accounts) or one person (their own accounts).
 * "all" combines every pot; transfers between pots are then internal.
 */
export type Scope = "all" | "household" | number;
export type Pot = "household" | number;

/** Default earner of an income: the owner of the receiving account, otherwise the household. */
export function earnerOfAccount(accountId: number | undefined | null, accounts: AccountDto[]): Pot {
    return accounts.find((a) => a.id === accountId)?.person_id ?? "household";
}

/** Shares that store the earner of an income: one person, or all household members for shared income. */
export function earnerShares(earner: Pot, persons: PersonDto[]): ShareDto[] {
    return earner === "household"
        ? persons.filter((p) => p.in_household).map((p) => ({person_id: p.id, weight: 1}))
        : [{person_id: earner, weight: 1}];
}

/** The pot an account belongs to; entries without account belong to the household. */
export function potOf(account: AccountDto | undefined): Pot {
    return account?.person_id ?? "household";
}

export type MonthEntry = {
    entry: ContractDto;
    amount: number; // full amount in the month
    own: number;    // part that counts for the selected scope
};

export type MonthSummary = {
    income: number;            // income booked to accounts of the scope
    transfersIn: number;       // money moved in from other pots (e.g. contributions, pocket money)
    transfersOut: number;      // money moved out to other pots
    transfersInBy: Record<string, number>;  // by source pot ("household" or person id)
    transfersOutBy: Record<string, number>; // by target pot
    expenses: number;          // costs paid from the scope (external persons' shares excluded)
    externalShare: number;     // part of those costs borne by external persons
    savings: number;           // net savings: deposits − withdrawals − costs paid from savings accounts
    fromSavings: number;       // withdrawals and costs paid from savings accounts
    available: number;         // income + transfersIn − transfersOut − expenses − savings
    householdCosts: number;    // of the expenses: assigned to the household
    privateCosts: Record<number, number>; // of the expenses: assigned to one person
    variableCosts: number;     // of the expenses: variable costs (budgets like groceries, fuel); the rest is fixed
    // amount per category; `variable` is the part from variable entries (plan for actual comparisons)
    byCategory: { id?: number; name: string; label: string; amount: number; variable: number }[];
    accounts: AccountFlow[];
    entries: MonthEntry[];
    unassignedAccount: number; // number of entries in this month without account
};

/**
 * Summarizes a month for a pot (household or person) or for all pots together.
 * Money belongs to the pot of the account it is booked on; nothing is split by percentages.
 */
export function summarizeMonth(
    contracts: ContractDto[],
    persons: PersonDto[],
    accounts: AccountDto[],
    month: Dayjs,
    mode: MonthMode,
    mainCurrency: string,
    scope: Scope = "all",
): MonthSummary {
    const inScope = (pot: Pot) => scope === "all" || pot === scope;
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const flows = new Map<number, AccountFlow>(
        accounts.filter((a) => inScope(potOf(a))).map((a) => [a.id, {account: a, inflow: 0, outflow: 0}]),
    );
    const byCategory = new Map<string, { id?: number; name: string; label: string; amount: number; variable: number }>();
    const privateCosts: Record<number, number> = {};
    const transfersInBy: Record<string, number> = {};
    const transfersOutBy: Record<string, number> = {};
    const entries: MonthEntry[] = [];

    let income = 0, expenses = 0, externalShare = 0, savings = 0, householdCosts = 0, variableCosts = 0;
    let transfersIn = 0, transfersOut = 0, unassignedAccount = 0, fromSavings = 0;

    for (const c of contracts) {
        if (c.currency && c.currency !== mainCurrency) continue;
        const amount = amountInMonth(c, month, mode);
        if (amount === 0) continue;

        const account = c.account_id != null ? accountById.get(c.account_id) : undefined;
        const target = c.target_account_id != null ? accountById.get(c.target_account_id) : undefined;
        const from = account && flows.get(account.id);
        const to = target && flows.get(target.id);
        const pot = potOf(account);
        let own = 0;

        if (c.kind === EntryKindIncome) {
            if (inScope(pot)) {
                own = amount;
                income += amount;
                if (from) from.inflow += amount;
            }
        } else if (c.kind === EntryKindExpense) {
            if (inScope(pot)) {
                own = amount * c.household_share;
                expenses += own;
                externalShare += amount - own;
                const owner = costOwner(c, persons, accounts);
                if (owner === "household") householdCosts += own;
                else privateCosts[owner] = (privateCosts[owner] ?? 0) + own;
                const groupKey = c.category_id != null ? String(c.category_id) : c.category;
                const cat = byCategory.get(groupKey)
                    ?? {id: c.category_id, name: c.category, label: categoryLabel(c.category, c.category_key), amount: 0, variable: 0};
                cat.amount += own;
                if (c.is_variable) {
                    cat.variable += own;
                    variableCosts += own;
                }
                byCategory.set(groupKey, cat);
                if (from) from.outflow += own;
                // paid from a savings account: spends money that was already set aside
                if (isSavingsAccount(account)) {
                    savings -= own;
                    fromSavings += own;
                }
            }
        } else if (c.kind === EntryKindTransfer && target) {
            if (from) from.outflow += amount;
            if (to) to.inflow += amount;
            const targetPot = potOf(target);
            const type = transferTypeOf(c, accountById);
            // deposit: money is set aside (into a savings goal or account)
            const isDeposit = type === TransferTypeSaving;
            // withdrawal: money comes back from the savings
            const isWithdrawal = type === TransferTypeWithdrawal;
            if (isDeposit && inScope(pot)) {
                own = amount;
                savings += amount;
            }
            if (isWithdrawal && inScope(pot)) {
                own = amount;
                savings -= amount;
                fromSavings += amount;
            }
            // money moving between pots (a deposit stays with the pot that saves it)
            if (!isDeposit && scope !== "all" && pot !== targetPot) {
                if (pot === scope) {
                    own = amount;
                    transfersOut += amount;
                    transfersOutBy[String(targetPot)] = (transfersOutBy[String(targetPot)] ?? 0) + amount;
                } else if (targetPot === scope) {
                    own = amount;
                    transfersIn += amount;
                    transfersInBy[String(pot)] = (transfersInBy[String(pot)] ?? 0) + amount;
                }
            }
        }

        const touchesScope = inScope(pot) || (c.kind === EntryKindTransfer && target != null && inScope(potOf(target)));
        if (!touchesScope) continue;
        entries.push({entry: c, amount, own});
        // entries without account are counted for the household; transfers need both accounts
        if (!account || (c.kind === EntryKindTransfer && !target)) unassignedAccount++;
    }

    return {
        income,
        transfersIn,
        transfersOut,
        transfersInBy,
        transfersOutBy,
        expenses,
        externalShare,
        savings,
        fromSavings,
        available: income + transfersIn - transfersOut - expenses - savings,
        householdCosts,
        privateCosts,
        variableCosts,
        byCategory: [...byCategory.values()].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount),
        accounts: [...flows.values()].filter((f) => f.inflow !== 0 || f.outflow !== 0),
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

        // every month counts with the amounts valid then (amount history), past and future
        const rateIn = (m: Dayjs, mode: MonthMode) => transfers.reduce((sum, c) => sum + amountInMonth(c, m, mode), 0);
        const since = goal.current_date ? dayjs(goal.current_date).startOf("month") : month;
        const elapsed = Math.max(0, month.diff(since, "month"));
        let current = goal.current_amount ?? 0;
        for (let i = 0; i < elapsed; i++) current += rateIn(since.add(i, "month"), "due");

        const result: GoalSummary = {goal, monthlyRate, current, transfers};
        const target = goal.target_amount;
        if (target != null && target > 0) {
            const missing = target - current;
            result.progress = Math.min(1, Math.max(0, current / target));
            if (missing > 0) {
                let saved = current;
                for (let k = 1; k <= 600 && !result.reachedOn; k++) {
                    saved += rateIn(month.add(k - 1, "month"), "average");
                    if (saved >= target) result.reachedOn = month.add(k, "month");
                }
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
