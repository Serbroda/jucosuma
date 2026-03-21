import {NavLink, useLoaderData} from "react-router";
import {Button} from "../components/catalyst/button.tsx";
import {
    ArrowDownIcon,
    ArrowDownTrayIcon,
    ArrowUpIcon,
    ChevronRightIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    XMarkIcon
} from "@heroicons/react/16/solid";
import {Badge} from "../components/catalyst/badge.tsx";
import {classNames} from "../utils/dom.utils.ts";
import image from "../assets/image.png";
import {Avatar} from "../components/catalyst/avatar.tsx";
import {Input, InputGroup} from "../components/catalyst/input.tsx";
import {useCallback, useEffect, useMemo, useState} from "react";
import {startWithAnyIgnoreCase} from "../utils/string.utils.ts";
import {formatCurrency} from "../utils/number.utils.ts";
import {billingPeriodShorthand} from "../utils/data.utils.ts";
import type {ContractDto, ContractHolderDto} from "../gen/types.gen.ts";
import {ContractStatusActive, ContractStatusCancelled, ContractStatusExpired} from "../gen/types.gen.ts";
import {Select} from "../components/catalyst/select.tsx";
import {usePreferences} from "../stores/usePreferences.ts";
import {apiBasePath} from "../config.ts";

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

type SortKey = "name" | "costs" | "next_billing_date" | "status";
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
            byCategory[c.category] = (byCategory[c.category] ?? 0) + c.monthly_costs;
        }
    }
    const categorySorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

    return {mainTotal, otherCurrencies, categorySorted};
}

export default function HomePage() {
    const {contracts, holders} = useLoaderData() as { contracts: ContractDto[]; holders: ContractHolderDto[] };
    const {mainCurrency} = usePreferences();
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterHolder, setFilterHolder] = useState<string>("all");
    const [showFilters, setShowFilters] = useState(false);
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

    const hasActiveFilters = filterStatus !== "all" || filterCategory !== "all" || filterHolder !== "all";

    const filteredContracts = useMemo(() => {
        if (!contracts) return [];
        let result = contracts.filter((c) => startWithAnyIgnoreCase(search, c.name, c.company));
        if (filterStatus !== "all") {
            result = result.filter((c) => c.status === filterStatus);
        }
        if (filterCategory !== "all") {
            result = result.filter((c) => c.category === filterCategory);
        }
        if (filterHolder !== "all") {
            result = result.filter((c) => c.contract_holder === filterHolder);
        }
        return sortContracts(result, sortKey, sortDir);
    }, [contracts, search, filterStatus, filterCategory, filterHolder, sortKey, sortDir]);

    // Costs based on filtered contracts (excluding expired)
    const filteredActive = useMemo(() => {
        return filteredContracts.filter((c) => c.status !== ContractStatusExpired);
    }, [filteredContracts]);

    const filtered = useMemo(() => computeCosts(filteredActive, mainCurrency), [filteredActive, mainCurrency]);

    // Global costs for reference (all non-expired contracts)
    const globalActive = useMemo(() => {
        if (!contracts) return [];
        return contracts.filter((c) => c.status !== ContractStatusExpired);
    }, [contracts]);

    const global = useMemo(() => computeCosts(globalActive, mainCurrency), [globalActive, mainCurrency]);

    const toggleSort = useCallback((key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }, [sortKey]);

    const clearFilters = () => {
        setFilterStatus("all");
        setFilterCategory("all");
        setFilterHolder("all");
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

            {/* Cost Summary */}
            {(filtered.mainTotal > 0 || Object.keys(filtered.otherCurrencies).length > 0) && (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Monthly</div>
                            <div className="text-2xl font-semibold text-zinc-950 dark:text-white mt-1">
                                {formatCurrency(filtered.mainTotal, mainCurrency)}
                            </div>
                            {Object.entries(filtered.otherCurrencies).map(([cur, amount]) => (
                                <div key={cur} className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
                                    + {formatCurrency(amount, cur)}
                                </div>
                            ))}
                            {hasActiveFilters && global.mainTotal !== filtered.mainTotal && (
                                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                    of {formatCurrency(global.mainTotal, mainCurrency)} total
                                </div>
                            )}
                        </div>
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Yearly</div>
                            <div className="text-2xl font-semibold text-zinc-950 dark:text-white mt-1">
                                {formatCurrency(filtered.mainTotal * 12, mainCurrency)}
                            </div>
                            {Object.entries(filtered.otherCurrencies).map(([cur, amount]) => (
                                <div key={cur} className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
                                    + {formatCurrency(amount * 12, cur)}
                                </div>
                            ))}
                            {hasActiveFilters && global.mainTotal !== filtered.mainTotal && (
                                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                                    of {formatCurrency(global.mainTotal * 12, mainCurrency)} total
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Category Breakdown */}
                    {filtered.categorySorted.length > 1 && (
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">By Category</div>
                            <div className="flex flex-col gap-2">
                                {filtered.categorySorted.map(([category, amount]) => {
                                    const percentage = filtered.mainTotal > 0 ? (amount / filtered.mainTotal) * 100 : 0;
                                    return (
                                        <div key={category} className="flex items-center gap-3">
                                            <span className="text-sm text-zinc-950 dark:text-white w-40 lg:w-48 truncate">{category}</span>
                                            <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-zinc-400 dark:bg-zinc-500 transition-all"
                                                    style={{width: `${percentage}%`}}
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
                </div>
            )}

            {/* Toolbar: Search + Actions */}
            <div className="flex gap-2 items-center">
                <div className="flex-grow">
                    <InputGroup>
                        <MagnifyingGlassIcon/>
                        <Input
                            type="search"
                            name="term"
                            placeholder="Search"
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </InputGroup>
                </div>
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
                <a href={`${apiBasePath}/contracts/export.csv`} download>
                    <Button plain className="hover:cursor-pointer">
                        <ArrowDownTrayIcon/>
                    </Button>
                </a>
                <Button className="hover:cursor-pointer" to="/contracts/add">
                    <PlusIcon/>
                    <span className="hidden lg:block">Add Contract</span>
                </Button>
            </div>

            {/* Filter Panel (collapsible) */}
            {showFilters && (
                <div className="flex flex-wrap items-center gap-2 -mt-3 px-1">
                    <Select
                        className="w-auto text-sm !py-1"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value={ContractStatusActive}>Active</option>
                        <option value={ContractStatusCancelled}>Cancelled</option>
                        <option value={ContractStatusExpired}>Expired</option>
                    </Select>
                    <Select
                        className="w-auto text-sm !py-1"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </Select>
                    <Select
                        className="w-auto text-sm !py-1"
                        value={filterHolder}
                        onChange={(e) => setFilterHolder(e.target.value)}
                    >
                        <option value="all">All Holders</option>
                        {holders?.map((h) => (
                            <option key={h.name} value={h.name}>{h.name}</option>
                        ))}
                    </Select>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                        >
                            <XMarkIcon className="size-3"/>
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* List Header: Count + Sort */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 -mb-2">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {filteredContracts.length} {filteredContracts.length === 1 ? 'contract' : 'contracts'}
                </span>
                <div className="hidden lg:flex items-center gap-0.5">
                    <SortButton field="name" label="Name"/>
                    <SortButton field="costs" label="Costs"/>
                    <SortButton field="next_billing_date" label="Billing"/>
                    <SortButton field="status" label="Status"/>
                </div>
            </div>

            {/* Contract List */}
            <ul className="flex flex-col -mt-2">
                {filteredContracts.map((contract) =>
                    <li key={contract.id}>
                        <NavLink
                            to={"/contracts/" + contract.id}
                            className="p-2 flex gap-2 items-center border-b border-zinc-200 dark:border-zinc-800 hover:cursor-pointer hover:bg-zinc-950/5 dark:hover:bg-white/5">

                            <Avatar
                                square={true}
                                className={classNames("w-10 h-10", contract?.icon_source ? '' : 'dark:invert')}
                                src={contract?.icon_source || image}/>

                            <div className="flex flex-col grow min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-base/6 font-semibold text-zinc-950 dark:text-white">
                                        {contract.name}
                                    </span>
                                    <Badge color={statusColor(contract.status)} className="shrink-0 text-xs">
                                        {contract.status}
                                    </Badge>
                                </div>
                                <div className="text-sm/6 text-zinc-500 dark:text-zinc-400">
                                    {contract.company}
                                </div>
                            </div>

                            {contract.costs &&
                                <Badge className="shrink-0">
                                    {formatCurrency(contract.costs, contract.currency) + (contract.billing_period ? ` ${billingPeriodShorthand(contract.billing_period)}` : '')}
                                </Badge>
                            }
                            <ChevronRightIcon className="h-5 w-5 shrink-0 text-zinc-950 dark:text-white"/>
                        </NavLink>
                    </li>
                )}
            </ul>

            {filteredContracts.length === 0 && contracts?.length > 0 && (
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8">
                    No contracts match your filters.
                </div>
            )}
        </div>
    )
}
