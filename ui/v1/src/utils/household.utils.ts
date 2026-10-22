import {
    AccountTypeCash,
    AccountTypeChecking,
    AccountTypeDepot,
    AccountTypeOther,
    AccountTypeSavings,
    BillingPeriodAnnually,
    BillingPeriodEveryTwoYears,
    BillingPeriodMonthly,
    BillingPeriodOneTime,
    BillingPeriodQuarterly,
    BillingPeriodSemiannual,
    BillingPeriodWeekly,
    EntryKindExpense,
    EntryKindIncome,
    EntryKindTransfer,
    type AccountDto,
    type CategoryDto,
    type ContractDto,
    GoalKindInvesting,
    type PersonDto,
    type SavingsGoalDto,
    type ShareDto,
} from "../gen/types.gen.ts";
import i18n from "../i18n";
import dayjs from "../lib/dayjs";

/** Entry kinds with translated labels; call during render so labels follow the language. */
export function entryKinds() {
    return [
        {value: EntryKindExpense, label: i18n.t("kinds.expense")},
        {value: EntryKindIncome, label: i18n.t("kinds.income")},
        {value: EntryKindTransfer, label: i18n.t("kinds.transfer")},
    ];
}

/** Intervals offered when entering costs, most common first. */
export const entryPeriods = [
    BillingPeriodMonthly,
    BillingPeriodAnnually,
    BillingPeriodQuarterly,
    BillingPeriodSemiannual,
    BillingPeriodWeekly,
    BillingPeriodEveryTwoYears,
    BillingPeriodOneTime,
];

export function accountTypes() {
    return [
        {value: AccountTypeChecking, label: i18n.t("accountTypes.checking")},
        {value: AccountTypeSavings, label: i18n.t("accountTypes.savings")},
        {value: AccountTypeDepot, label: i18n.t("accountTypes.depot")},
        {value: AccountTypeCash, label: i18n.t("accountTypes.cash")},
        {value: AccountTypeOther, label: i18n.t("accountTypes.other")},
    ];
}

/** Icon key and colour slot an account shows by default, per account type. */
export const accountTypeStyle: Record<string, { icon: string; color: number }> = {
    [AccountTypeChecking]: {icon: "bank", color: 1},
    [AccountTypeSavings]: {icon: "banknotes", color: 3},
    [AccountTypeDepot]: {icon: "chart", color: 7},
    [AccountTypeCash]: {icon: "wallet", color: 4},
    [AccountTypeOther]: {icon: "wallet", color: 2},
};

/** The account's own icon and colour, otherwise those of its type. */
export function accountStyle(a: Pick<AccountDto, "type" | "icon" | "color">): { icon: string; color: number } {
    const byType = accountTypeStyle[a.type] ?? accountTypeStyle[AccountTypeOther];
    return {icon: a.icon || byType.icon, color: a.color ?? byType.color};
}

/** The goal's own icon and colour, otherwise those of its kind (saving or investing). */
export function goalStyle(g: Pick<SavingsGoalDto, "kind" | "icon" | "color">): { icon: string; color: number } {
    const byKind = g.kind === GoalKindInvesting ? {icon: "chart", color: 7} : {icon: "sparkles", color: 3};
    return {icon: g.icon || byKind.icon, color: g.color ?? byKind.color};
}

/** Icon of categories without own icon. */
export const defaultCategoryIcon = "ellipsis";

export function entryKindLabel(kind: string | undefined): string {
    return entryKinds().find((k) => k.value === kind)?.label ?? i18n.t("kinds.expense");
}

export function accountTypeLabel(type: string | undefined): string {
    return accountTypes().find((t) => t.value === type)?.label ?? type ?? "";
}

/** Account owner as text: the person's name or "Shared". */
export function accountOwnerLabel(account: AccountDto, persons: PersonDto[]): string {
    if (account.person_id == null) return i18n.t("common.shared");
    return persons.find((p) => p.id === account.person_id)?.name ?? i18n.t("common.unknown");
}

export function accountName(id: number | null | undefined, accounts: AccountDto[]): string | undefined {
    if (id == null) return undefined;
    return accounts.find((a) => a.id === id)?.name;
}

const lastAccountKey = (kind: string, field: string) => `lastAccount:${kind}:${field}`;

/** Remembers the last used account per entry kind so the quick entry can preselect it. */
export function rememberAccount(kind: string, field: "from" | "to", id: number | undefined) {
    try {
        if (id != null) localStorage.setItem(lastAccountKey(kind, field), String(id));
    } catch {
        // storage unavailable, ignore
    }
}

export function recallAccount(kind: string, field: "from" | "to", accounts: AccountDto[]): number | undefined {
    let stored: string | null = null;
    try {
        stored = localStorage.getItem(lastAccountKey(kind, field));
    } catch {
        // storage unavailable, ignore
    }
    const id = stored ? Number(stored) : undefined;
    if (id != null && accounts.some((a) => a.id === id)) return id;
    if (field === "to") return accounts.find((a) => a.person_id != null)?.id ?? accounts[1]?.id;
    return accounts.find((a) => a.person_id == null && a.type === AccountTypeChecking)?.id ?? accounts[0]?.id;
}

export type SharePreset = { key: string; label: string; shares: ShareDto[] };

export function sharePresets(persons: PersonDto[]): SharePreset[] {
    const household = persons.filter((p) => p.in_household);
    const presets: SharePreset[] = [];
    if (household.length > 1) {
        presets.push({
            key: "household",
            label: i18n.t("shares.household"),
            shares: household.map((p) => ({person_id: p.id, weight: 1})),
        });
    }
    for (const p of household) {
        presets.push({key: `only-${p.id}`, label: i18n.t("shares.only", {name: p.name}), shares: [{person_id: p.id, weight: 1}]});
    }
    return presets;
}

/** Default shares for new expenses: split equally across the household. */
export function defaultShares(persons: PersonDto[]): ShareDto[] {
    return sharePresets(persons)[0]?.shares ?? [];
}

/** Whether an expense is carried as its account suggests (see sharesForAccount), i.e. nothing worth pointing out. */
export function isDefaultAssignment(c: ContractDto, persons: PersonDto[], accounts: AccountDto[]): boolean {
    if (c.shares.length === 0) return true;
    const norm = (shares: ShareDto[]) => {
        const total = shares.reduce((s, x) => s + x.weight, 0);
        return shares.filter((x) => x.weight > 0).map((x) => `${x.person_id}:${(x.weight / total).toFixed(4)}`).sort().join(",");
    };
    return norm(c.shares) === norm(sharesForAccount(c.account_id, accounts, persons));
}

/**
 * Who carries an expense by default: the owner of a private account, the household for a shared
 * account. Forms follow the chosen account with this until the user picks something else.
 */
export function sharesForAccount(accountId: number | null | undefined, accounts: AccountDto[], persons: PersonDto[]): ShareDto[] {
    const owner = accounts.find((a) => a.id === accountId)?.person_id;
    return owner != null && persons.some((p) => p.id === owner && p.in_household)
        ? [{person_id: owner, weight: 1}]
        : defaultShares(persons);
}

/**
 * Display name of a category: predefined categories (with a key) are translated,
 * categories created by users are shown as entered.
 */
export function categoryLabel(name: string, key?: string | null): string {
    const id = `categories.${key}`;
    return key && i18n.exists(id) ? i18n.t(id as "categories.other") : name;
}


/** Palette slots for household members, in order (aqua, violet, orange, …). */
const PERSON_SLOTS = [3, 7, 2, 4, 5, 1, 6, 8];

/** Stable palette slot of a household person (by order), so a person keeps one colour everywhere. */
export function personSlot(persons: PersonDto[], personId: number): number | undefined {
    const index = persons.filter((p) => p.in_household).findIndex((p) => p.id === personId);
    return index >= 0 ? PERSON_SLOTS[index % PERSON_SLOTS.length] : undefined;
}

/** "3 months" / "6 weeks" for a notice period, or undefined without one. */
export function noticeLabel(period?: number | null, unit?: string | null): string | undefined {
    if (period == null || !unit) return undefined;
    const key = `contracts.unitCount.${unit}`;
    return i18n.exists(`${key}_other`) ? i18n.t(key as "contracts.unitCount.months", {count: period}) : `${period} ${unit}`;
}

/** Predefined categories whose entries are usually contracts (the "is contract" switch starts on). */
const CONTRACT_CATEGORY_KEYS = ["insurance", "telecom", "utilities", "housing"];

export function isContractCategory(category: CategoryDto | undefined): boolean {
    return !!category?.key && CONTRACT_CATEGORY_KEYS.includes(category.key);
}

/** Cost type of an expense: variable (budget), fixed, or fixed with contract data. */
export type CostType = "variable" | "fixed" | "contract";

export function costTypeOf(c: Pick<ContractDto, "is_contract" | "is_variable">): CostType {
    return c.is_contract ? "contract" : c.is_variable ? "variable" : "fixed";
}

/** Predefined categories whose entries are usually variable (budgets). */
const VARIABLE_CATEGORY_KEYS = ["groceries", "leisure", "other"];

/**
 * Suggested cost type for a new expense of a category: contract and variable categories by their
 * key, otherwise what most existing expenses of the category use (e.g. mobility: ticket vs. fuel).
 */
export function defaultCostType(category: CategoryDto | undefined, contracts: ContractDto[] = []): CostType {
    if (!category) return "variable";
    if (isContractCategory(category)) return "contract";
    if (category.key && VARIABLE_CATEGORY_KEYS.includes(category.key)) return "variable";
    const counts = new Map<CostType, number>();
    for (const c of contracts) {
        if (c.kind === EntryKindExpense && c.category_id === category.id) counts.set(costTypeOf(c), (counts.get(costTypeOf(c)) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "fixed";
}

/** Entries shown on the contracts page: expenses explicitly marked as contract. */
export function isContractEntry(c: ContractDto): boolean {
    return c.is_contract && c.kind === EntryKindExpense;
}

/** Whole days from today until a date (negative if past). */
export function daysUntil(date: string): number {
    return dayjs(date).startOf("day").diff(dayjs().startOf("day"), "day");
}
