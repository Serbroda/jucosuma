import type {TFunction} from "i18next";
import type {ContractDto} from "../gen/types.gen.ts";
import type {AppData} from "../hooks/useAppData.ts";
import type {TableFilterDef} from "../hooks/useTableFilter.ts";
import {matchesOwner} from "./budget.utils.ts";
import {categoryLabel, sortedByName} from "./household.utils.ts";

/** Text an entry is found by in table searches: name, company, contract number and category. */
export function entrySearchText(c: ContractDto, data: AppData): string {
    const cat = data.categories.find((x) => x.id === c.category_id);
    return [c.name, c.company, c.contract_number, cat ? categoryLabel(cat.name, cat.key) : c.category].filter(Boolean).join(" ");
}

/** Filters by assignment, account and category; each only offers values that occur in the entries. */
export function entryFilters(entries: ContractDto[], data: AppData, t: TFunction): TableFilterDef<ContractDto>[] {
    const accountIds = (c: ContractDto) => [c.account_id, c.target_account_id].filter((id): id is number => id != null);
    const usedAccounts = new Set(entries.flatMap(accountIds));
    const usedCategories = new Set(entries.map((c) => c.category_id));
    const household = data.persons.filter((p) => p.in_household);
    const linkedContacts = data.contacts.filter((k) => entries.some((c) => c.contact_id === k.id));
    return [
        {
            key: "owner", label: t('table.owner'),
            options: household.length < 2 ? [] : [
                {value: "household", label: t('common.household')},
                ...household.map((p) => ({value: String(p.id), label: p.name})),
            ],
            test: (c, v) => matchesOwner(c, v === "household" ? "household" : Number(v), data.persons, data.accounts),
        },
        {
            key: "account", label: t('table.account'),
            options: sortedByName(data.accounts.filter((a) => usedAccounts.has(a.id)).map((a) => ({value: String(a.id), label: a.name})), (o) => o.label),
            test: (c, v) => accountIds(c).includes(Number(v)),
        },
        {
            key: "category", label: t('table.category'),
            options: sortedByName(data.categories.filter((cat) => usedCategories.has(cat.id))
                .map((cat) => ({value: String(cat.id), label: categoryLabel(cat.name, cat.key)})), (o) => o.label),
            test: (c, v) => c.category_id === Number(v),
        },
        {
            key: "contact", label: t('table.contact'),
            // only once contacts are in use; "without contact" helps to find entries still to link
            options: linkedContacts.length === 0 ? [] : [
                ...sortedByName(linkedContacts, (k) => k.name).map((k) => ({value: String(k.id), label: k.name})),
                ...(entries.some((c) => c.contact_id == null) ? [{value: "none", label: t('table.noContact')}] : []),
            ],
            test: (c, v) => v === "none" ? c.contact_id == null : c.contact_id === Number(v),
        },
    ];
}
