import {NavLink, useLoaderData} from "react-router";
import {Button} from "../components/catalyst/button.tsx";
import {
    ArrowDownIcon,
    ArrowDownTrayIcon,
    ArrowUpIcon,
    ArrowUpTrayIcon,
    ChevronRightIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    LockClosedIcon,
    XMarkIcon
} from "@heroicons/react/16/solid";
import {Badge} from "../components/catalyst/badge.tsx";
import {classNames} from "../utils/dom.utils.ts";
import {Input, InputGroup} from "../components/catalyst/input.tsx";
import {useCallback, useEffect, useMemo, useState} from "react";
import {startWithAnyIgnoreCase} from "../utils/string.utils.ts";
import {formatCurrency} from "../utils/number.utils.ts";
import {billingPeriodShorthand} from "../utils/data.utils.ts";
import type {AccountDto, CategoryDto, ContractDto, ContractHolderDto, PersonDto} from "../gen/types.gen.ts";
import {
    ContractStatusActive,
    ContractStatusCancelled,
    ContractStatusExpired,
    EntryKindExpense,
    EntryKindIncome,
} from "../gen/types.gen.ts";
import QuickEntryDialog from "../components/QuickEntryDialog.tsx";
import {accountName, categoryLabel, categoryLabelByName, entryKinds} from "../utils/household.utils.ts";
import {useTranslation} from "react-i18next";
import {Select} from "../components/catalyst/select.tsx";
import {usePreferences} from "../stores/usePreferences.ts";
import {useAuth} from "../stores/useAuth.ts";
import {apiBasePath} from "../config.ts";
import dayjs from "../lib/dayjs";
import ImportDialog from "../components/ImportDialog.tsx";
import EntryIcon from "../components/EntryIcon.tsx";
import {Heading} from "../components/catalyst/heading.tsx";
import {card, cardTitle, statLabel, statValue} from "../utils/ui.ts";

const statusColor = (status: string): "green" | "yellow" | "zinc" => {
    switch (status) {
        case "active":
            return "green";
        case "cancelled":
            return "yellow";
        case "expired":
            return "zinc";
        default:
            return "zinc";
    }
};

type SortKey = "name" | "company" | "costs" | "next_billing_date" | "status";
type SortDir = "asc" | "desc";

const statusOrder: Record<string, number> = {active: 0, cancelled: 1, expired: 2};

function sortContracts(contracts: ContractDto[], sortKey: SortKey, sortDir: SortDir): ContractDto[] {
    const sorted = [...contracts];
    sorted.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
            case "name":
                cmp = a.name.localeCompare(b.name);
                break;
            case "company":
                cmp = (a.company ?? '').localeCompare(b.company ?? '');
                break;
            case "costs":
                cmp = (a.monthly_costs ?? 0) - (b.monthly_costs ?? 0);
                break;
            case "next_billing_date":
                cmp = (a.next_billing_date ?? "").localeCompare(b.next_billing_date ?? "");
                break;
            case "status":
                cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
                break;
        }
        return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
}

function computeCosts(contracts: ContractDto[], mainCurrency: string) {
    const mainTotal = contracts
        .filter((c) => !c.currency || c.currency === mainCurrency)
        .reduce((sum, c) => sum + (c.monthly_costs ?? 0), 0);

    const otherCurrencies: Record<string, number> = {};
    for (const c of contracts) {
        if (c.currency && c.currency !== mainCurrency && c.monthly_costs) {
            otherCurrencies[c.currency] = (otherCurrencies[c.currency] ?? 0) + c.monthly_costs;
        }
    }

    const byCategory: Record<string, number> = {};
    for (const c of contracts) {
        if (c.monthly_costs && (!c.currency || c.currency === mainCurrency)) {
            const label = categoryLabel(c.category, c.category_key);
            byCategory[label] = (byCategory[label] ?? 0) + c.monthly_costs;
        }
    }
    const categorySorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

    return {mainTotal, otherCurrencies, categorySorted};
}

export default function HomePage() {
    const {contracts, holders, persons, accounts, categories: allCategories} = useLoaderData() as {
        contracts: ContractDto[];
        holders: ContractHolderDto[];
        persons: PersonDto[];
        accounts: AccountDto[];
        categories: CategoryDto[];
    };
    const [showQuickEntry, setShowQuickEntry] = useState(false);
    const [filterKind, setFilterKind] = useState<string>("all");
    const {mainCurrency} = usePreferences();
    const {t, i18n} = useTranslation();
    const {user: currentUser} = useAuth();
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterHolder, setFilterHolder] = useState<string>("all");
    const [filterVisibility, setFilterVisibility] = useState<string>("all");
    const [showFilters, setShowFilters] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const categories = useMemo(() => {
        if (!contracts) return [];
        const cats = new Set(contracts.map((c) => c.category));
        return Array.from(cats).sort();
    }, [contracts]);

    const hasActiveFilters = filterKind !== "all" || filterStatus !== "all" || filterCategory !== "all" || filterHolder !== "all" || filterVisibility !== "all";

    const filteredContracts = useMemo(() => {
        if (!contracts) return [];
        let result = contracts.filter((c) => startWithAnyIgnoreCase(search, c.name, c.company ?? ''));
        if (filterKind !== "all") {
            result = result.filter((c) => c.kind === filterKind);
        }
        if (filterStatus !== "all") {
            result = result.filter((c) => c.status === filterStatus);
        }
        if (filterCategory !== "all") {
            result = result.filter((c) => c.category === filterCategory);
        }
        if (filterHolder !== "all") {
            result = result.filter((c) => c.contract_holder === filterHolder);
        }
        if (filterVisibility === "shared") {
            result = result.filter((c) => !c.owner_id);
        } else if (filterVisibility === "mine") {
            result = result.filter((c) => c.owner_id === currentUser?.id);
        }
        return sortContracts(result, sortKey, sortDir);
    }, [contracts, search, filterKind, filterStatus, filterCategory, filterHolder, filterVisibility, currentUser, sortKey, sortDir]);

    // Costs based on filtered contracts (excluding expired)
    const filteredActive = useMemo(() => {
        return filteredContracts.filter((c) => c.status !== ContractStatusExpired && c.kind === EntryKindExpense);
    }, [filteredContracts]);

    const filtered = useMemo(() => computeCosts(filteredActive, mainCurrency), [filteredActive, mainCurrency]);

    // Global costs for reference (all non-expired contracts)
    const globalActive = useMemo(() => {
        if (!contracts) return [];
        return contracts.filter((c) => c.status !== ContractStatusExpired && c.kind === EntryKindExpense);
    }, [contracts]);

    const global = useMemo(() => computeCosts(globalActive, mainCurrency), [globalActive, mainCurrency]);

    // Dashboard widgets
    const upcomingBilling = useMemo(() => {
        if (!contracts) return [];
        return contracts
            .filter(c => c.next_billing_date && c.status !== ContractStatusExpired)
            .sort((a, b) => (a.next_billing_date ?? '').localeCompare(b.next_billing_date ?? ''))
            .slice(0, 5);
    }, [contracts]);

    const expiringSoon = useMemo(() => {
        if (!contracts) return [];
        const now = dayjs();
        const cutoff = now.add(90, 'day');
        return contracts
            .filter(c => c.end_date && c.status === ContractStatusCancelled
                && dayjs(c.end_date).isAfter(now) && dayjs(c.end_date).isBefore(cutoff))
            .sort((a, b) => (a.end_date ?? '').localeCompare(b.end_date ?? ''));
    }, [contracts]);

    const toggleSort = useCallback((key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }, [sortKey]);

    const clearFilters = () => {
        setFilterKind("all");
        setFilterStatus("all");
        setFilterCategory("all");
        setFilterHolder("all");
        setFilterVisibility("all");
    };

    const SortButton = ({field, label}: { field: SortKey; label: string }) => (
        <button
            onClick={() => toggleSort(field)}
            className={classNames(
                "px-1.5 py-0.5 rounded text-xs transition-colors",
                sortKey === field
                    ? "font-semibold text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800"
                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
        >
            {label}
            {sortKey === field && (
                sortDir === "asc"
                    ? <ArrowUpIcon className="size-3 inline ml-0.5"/>
                    : <ArrowDownIcon className="size-3 inline ml-0.5"/>
            )}
        </button>
    );

    return (
        <div className="flex flex-col gap-6">
            <Heading>{t('nav.entries')}</Heading>

            {/* Cost Summary */}
            {(filtered.mainTotal > 0 || Object.keys(filtered.otherCurrencies).length > 0) && (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className={card}>
                            <div className={statLabel}>{t('entries.monthly')}</div>
                            <div className={statValue}>
                                {formatCurrency(filtered.mainTotal, mainCurrency)}
                            </div>
                            {Object.entries(filtered.otherCurrencies).map(([cur, amount]) => (
                                <div key={cur} className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
                                    + {formatCurrency(amount, cur)}
                                </div>
                            ))}
                            {hasActiveFilters && global.mainTotal !== filtered.mainTotal && (
                                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                    {t('entries.ofTotal', {amount: formatCurrency(global.mainTotal, mainCurrency)})}
                                </div>
                            )}
                        </div>
                        <div className={card}>
                            <div className={statLabel}>{t('entries.yearly')}</div>
                            <div className={statValue}>
                                {formatCurrency(filtered.mainTotal * 12, mainCurrency)}
                            </div>
                            {Object.entries(filtered.otherCurrencies).map(([cur, amount]) => (
                                <div key={cur} className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
                                    + {formatCurrency(amount * 12, cur)}
                                </div>
                            ))}
                            {hasActiveFilters && global.mainTotal !== filtered.mainTotal && (
                                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                    {t('entries.ofTotal', {amount: formatCurrency(global.mainTotal * 12, mainCurrency)})}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Category Breakdown + Next Billing side by side */}
                    {(filtered.categorySorted.length > 1 || upcomingBilling.length > 0) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {filtered.categorySorted.length > 1 && (
                                <div className={card}>
                                    <div className={cardTitle + " mb-3"}>{t('entries.byCategory')}</div>
                                    <div className={classNames("flex flex-col gap-2", filtered.categorySorted.length > 4 ? "max-h-40 overflow-y-auto overflow-x-hidden" : "")}>
                                        {filtered.categorySorted.map(([category, amount]) => {
                                            const percentage = filtered.mainTotal > 0 ? (amount / filtered.mainTotal) * 100 : 0;
                                            return (
                                                <div key={category} className="flex items-center gap-3">
                                                    <span className="text-sm text-zinc-950 dark:text-white w-28 sm:w-40 truncate">{category}</span>
                                                    <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{width: `${percentage}%`, background: "var(--chart-series-1)"}}
                                                        />
                                                    </div>
                                                    <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400 w-24 text-right">
                                                        {formatCurrency(amount, mainCurrency)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {upcomingBilling.length > 0 && (
                                <div className={card}>
                                    <div className={cardTitle + " mb-3"}>{t('entries.nextBilling')}</div>
                                    <div className={classNames("flex flex-col gap-2", upcomingBilling.length > 4 ? "max-h-40 overflow-y-auto overflow-x-hidden" : "")}>
                                        {upcomingBilling.map((c) => (
                                            <NavLink key={c.id} to={`/contracts/${c.id}`}
                                                     className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded -mx-1 px-1 py-0.5 transition-colors">
                                                <EntryIcon name={c.name} icon={c.icon_source} className="size-6"/>
                                                <span className="text-sm text-zinc-950 dark:text-white truncate grow">{c.name}</span>
                                                <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0">
                                                    {dayjs(c.next_billing_date).format('DD.MM.')}
                                                </span>
                                                {c.costs && (
                                                    <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                                                        {formatCurrency(c.costs, c.currency)}
                                                    </span>
                                                )}
                                            </NavLink>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Expiring Soon */}
                    {expiringSoon.length > 0 && (
                        <div className={card}>
                            <div className={cardTitle + " mb-3"}>{t('entries.expiringSoon')}</div>
                            <div className="flex flex-col gap-2">
                                {expiringSoon.map((c) => {
                                    const daysLeft = dayjs(c.end_date).diff(dayjs(), 'day');
                                    const urgency = daysLeft <= 30 ? 'text-red-500' : daysLeft <= 60 ? 'text-amber-500' : 'text-zinc-400';
                                    return (
                                        <NavLink key={c.id} to={`/contracts/${c.id}`}
                                                 className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded -mx-1 px-1 py-0.5 transition-colors">
                                            <EntryIcon name={c.name} icon={c.icon_source} className="size-6"/>
                                            <span className="text-sm text-zinc-950 dark:text-white truncate grow">{c.name}</span>
                                            <span className={classNames("text-xs tabular-nums shrink-0", urgency)}>
                                                {t('entries.daysLeft', {count: daysLeft})}
                                            </span>
                                            <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0">
                                                {dayjs(c.end_date).format('DD.MM.YY')}
                                            </span>
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Toolbar: Search + Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex gap-2 items-center sm:flex-grow">
                    <div className="flex-grow">
                        <InputGroup>
                            <MagnifyingGlassIcon/>
                            <Input
                                type="search"
                                name="term"
                                placeholder={t('common.search')}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </InputGroup>
                    </div>
                    {/* Mobile only: Add button next to search */}
                    <Button className="hover:cursor-pointer sm:hidden" onClick={() => setShowQuickEntry(true)}>
                        <PlusIcon/>
                    </Button>
                </div>
                <div className="flex gap-1 items-center">
                    <Button
                        plain
                        className={classNames(
                            "hover:cursor-pointer relative",
                            hasActiveFilters ? "text-zinc-950 dark:text-white" : ""
                        )}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FunnelIcon/>
                        {hasActiveFilters && (
                            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-500"/>
                        )}
                    </Button>
                    <Button plain className="hover:cursor-pointer" onClick={() => setShowImport(true)}>
                        <ArrowUpTrayIcon/>
                    </Button>
                    <div className="relative">
                        <Button plain className="hover:cursor-pointer" onClick={() => setShowExportMenu(!showExportMenu)}>
                            <ArrowDownTrayIcon/>
                        </Button>
                        {showExportMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}/>
                                <div className="absolute right-0 top-full mt-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-20 min-w-[100px]">
                                    <a href={`${apiBasePath}/contracts/export.csv`} download
                                       onClick={() => setShowExportMenu(false)}
                                       className="px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-t-lg">
                                        CSV
                                    </a>
                                    <a href={`${apiBasePath}/contracts/export.json`} download
                                       onClick={() => setShowExportMenu(false)}
                                       className="px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-b-lg">
                                        JSON
                                    </a>
                                </div>
                            </>
                        )}
                    </div>
                    <span className="hidden sm:inline-flex ml-auto">
                        <Button className="hover:cursor-pointer" onClick={() => setShowQuickEntry(true)}>
                            <PlusIcon/>
                            <span className="hidden lg:block">{t('entries.addEntry')}</span>
                        </Button>
                    </span>
                </div>
            </div>

            {/* Filter Panel (collapsible) */}
            {showFilters && (
                <div className="flex flex-wrap items-center gap-2 -mt-3 px-1">
                    <Select
                        className="w-full sm:w-auto text-sm !py-1"
                        value={filterKind}
                        onChange={(e) => setFilterKind(e.target.value)}
                    >
                        <option value="all">{t('entries.allTypes')}</option>
                        {entryKinds().map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </Select>
                    <Select
                        className="w-full sm:w-auto text-sm !py-1"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">{t('entries.allStatus')}</option>
                        <option value={ContractStatusActive}>{t('status.active')}</option>
                        <option value={ContractStatusCancelled}>{t('status.cancelled')}</option>
                        <option value={ContractStatusExpired}>{t('status.expired')}</option>
                    </Select>
                    <Select
                        className="w-full sm:w-auto text-sm !py-1"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">{t('entries.allCategories')}</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>{categoryLabelByName(cat, allCategories)}</option>
                        ))}
                    </Select>
                    <Select
                        className="w-full sm:w-auto text-sm !py-1"
                        value={filterHolder}
                        onChange={(e) => setFilterHolder(e.target.value)}
                    >
                        <option value="all">{t('entries.allHolders')}</option>
                        {holders?.map((h) => (
                            <option key={h.name} value={h.name}>{h.name}</option>
                        ))}
                    </Select>
                    <Select
                        className="w-full sm:w-auto text-sm !py-1"
                        value={filterVisibility}
                        onChange={(e) => setFilterVisibility(e.target.value)}
                    >
                        <option value="all">{t('entries.allEntries')}</option>
                        <option value="shared">{t('entries.sharedOnly')}</option>
                        <option value="mine">{t('entries.myPersonal')}</option>
                    </Select>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                        >
                            <XMarkIcon className="size-3"/>
                            {t('common.clear')}
                        </button>
                    )}
                </div>
            )}

            {/* List Header: Count + Sort */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 -mb-2">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {t('entries.count', {count: filteredContracts.length})}
                </span>

                {/* Mobile sort */}
                <div className="lg:hidden">
                    <select
                        value={`${sortKey}:${sortDir}`}
                        onChange={(e) => {
                            const [key, dir] = e.target.value.split(':') as [SortKey, SortDir];
                            setSortKey(key);
                            setSortDir(dir);
                        }}
                        className="text-xs bg-transparent text-zinc-500 dark:text-zinc-400 border-none pr-6 py-0 focus:ring-0"
                    >
                        <option value="name:asc">{t('entries.sort.nameAsc')}</option>
                        <option value="name:desc">{t('entries.sort.nameDesc')}</option>
                        <option value="company:asc">{t('entries.sort.companyAsc')}</option>
                        <option value="company:desc">{t('entries.sort.companyDesc')}</option>
                        <option value="costs:desc">{t('entries.sort.costsDesc')}</option>
                        <option value="costs:asc">{t('entries.sort.costsAsc')}</option>
                        <option value="next_billing_date:asc">{t('entries.sort.billingAsc')}</option>
                        <option value="next_billing_date:desc">{t('entries.sort.billingDesc')}</option>
                        <option value="status:asc">{t('entries.sort.statusAsc')}</option>
                    </select>
                </div>

                {/* Desktop sort */}
                <div className="hidden lg:flex items-center gap-0.5">
                    <SortButton field="name" label={t('entries.sort.name')}/>
                    <SortButton field="company" label={t('entries.sort.company')}/>
                    <SortButton field="costs" label={t('entries.sort.costs')}/>
                    <SortButton field="next_billing_date" label={t('entries.sort.billing')}/>
                    <SortButton field="status" label={t('entries.sort.status')}/>
                </div>
            </div>

            {/* Contract List */}
            <ul className="flex flex-col -mt-2">
                {filteredContracts.map((contract) =>
                    <li key={contract.id}>
                        <NavLink
                            to={"/contracts/" + contract.id}
                            className="p-2 py-3 sm:py-2 flex gap-2 items-center border-b border-zinc-200 dark:border-zinc-800 hover:cursor-pointer hover:bg-zinc-950/5 dark:hover:bg-white/5">

                            <EntryIcon name={contract.name} icon={contract.icon_source} className="size-10"/>

                            <div className="flex flex-col grow min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="truncate text-base/6 sm:text-sm/6 font-semibold text-zinc-950 dark:text-white">
                                        {contract.name}
                                    </span>
                                    {contract.status !== ContractStatusActive && (
                                        <span className="hidden sm:inline-flex">
                                            <Badge color={statusColor(contract.status)} className="shrink-0 text-xs">
                                                {t(`status.${contract.status}` as 'status.active')}
                                            </Badge>
                                        </span>
                                    )}
                                    {contract.owner_id && (
                                        <LockClosedIcon className="size-3 shrink-0 text-zinc-400 dark:text-zinc-500" title={t('entries.personal')}/>
                                    )}
                                </div>
                                <div className="text-xs sm:text-sm/6 text-zinc-500 dark:text-zinc-400 truncate">
                                    {[
                                        contract.company,
                                        accountName(contract.account_id, accounts),
                                        contract.kind === EntryKindExpense && contract.household_share < 1
                                            ? t('entries.householdPercent', {percent: (Math.round(contract.household_share * 1000) / 10).toLocaleString(i18n.language)}) : undefined,
                                    ].filter(Boolean).join(' · ')}
                                </div>
                                {/* Mobile: status + costs under subtitle */}
                                <div className="flex items-center gap-1.5 mt-0.5 sm:hidden">
                                    {contract.status !== ContractStatusActive && (
                                        <Badge color={statusColor(contract.status)} className="text-xs">
                                            {t(`status.${contract.status}` as 'status.active')}
                                        </Badge>
                                    )}
                                    {contract.costs && (
                                        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                            {formatCurrency(contract.costs, contract.currency)}
                                            {contract.billing_period ? ` ${billingPeriodShorthand(contract.billing_period)}` : ''}

                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Desktop: costs badge */}
                            {contract.costs &&
                                <span className="hidden sm:inline-flex">
                                    <Badge className="shrink-0" color={contract.kind === EntryKindIncome ? "green" : "zinc"}>
                                        {formatCurrency(contract.costs, contract.currency) + (contract.billing_period ? ` ${billingPeriodShorthand(contract.billing_period)}` : '')}
                                    </Badge>
                                </span>
                            }
                            <ChevronRightIcon className="h-5 w-5 shrink-0 text-zinc-950 dark:text-white hidden sm:block"/>
                        </NavLink>
                    </li>
                )}
            </ul>

            {filteredContracts.length === 0 && contracts?.length > 0 && (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
                    {t('entries.noMatch')}
                </div>
            )}

            <ImportDialog isOpen={showImport} onClose={() => setShowImport(false)}/>
            <QuickEntryDialog
                isOpen={showQuickEntry}
                onClose={() => setShowQuickEntry(false)}
                persons={persons}
                accounts={accounts}
                categories={allCategories}
            />
        </div>
    )
}
