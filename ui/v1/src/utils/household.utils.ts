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
    type PersonDto,
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

/** Entries shown on the contracts page: expenses explicitly marked as contract. */
export function isContractEntry(c: ContractDto): boolean {
    return c.is_contract && c.kind === EntryKindExpense;
}

/** Whole days from today until a date (negative if past). */
export function daysUntil(date: string): number {
    return dayjs(date).startOf("day").diff(dayjs().startOf("day"), "day");
}
