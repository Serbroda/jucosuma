import {NavLink, useLoaderData} from "react-router";
import {Button} from "../components/catalyst/button.tsx";
import {
    ArrowDownIcon,
    ArrowDownTrayIcon,
    ArrowUpIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    PlusIcon
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
import type {ContractDto} from "../gen/types.gen.ts";
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

export default function HomePage() {
    const {contracts} = useLoaderData() as { contracts: ContractDto[] };
    const {mainCurrency} = usePreferences();
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
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

    const filteredContracts = useMemo(() => {
        if (!contracts) return [];
        let result = contracts.filter((c) => startWithAnyIgnoreCase(search, c.name, c.company));
        if (filterStatus !== "all") {
            result = result.filter((c) => c.status === filterStatus);
        }
        if (filterCategory !== "all") {
            result = result.filter((c) => c.category === filterCategory);
        }
        return sortContracts(result, sortKey, sortDir);
    }, [contracts, search, filterStatus, filterCategory, sortKey, sortDir]);

    const activeContracts = useMemo(() => {
        if (!contracts) return [];
        return contracts.filter((c) => c.status !== ContractStatusExpired);
    }, [contracts]);

    const totalMonthlyCosts = useMemo(() => {
        return activeContracts
            .filter((c) => !c.currency || c.currency === mainCurrency)
            .reduce((sum, c) => sum + (c.monthly_costs ?? 0), 0);
    }, [activeContracts, mainCurrency]);

    const otherCurrencyCosts = useMemo(() => {
        const byCurrency: Record<string, number> = {};
        for (const c of activeContracts) {
            if (c.currency && c.currency !== mainCurrency && c.monthly_costs) {
                byCurrency[c.currency] = (byCurrency[c.currency] ?? 0) + c.monthly_costs;
            }
        }
        return byCurrency;
    }, [activeContracts, mainCurrency]);

    const costsByCategory = useMemo(() => {
        const byCategory: Record<string, number> = {};
        for (const c of activeContracts) {
            if (c.monthly_costs && (!c.currency || c.currency === mainCurrency)) {
                byCategory[c.category] = (byCategory[c.category] ?? 0) + c.monthly_costs;
            }
        }
        return Object.entries(byCategory)
            .sort(([, a], [, b]) => b - a);
    }, [activeContracts, mainCurrency]);

    const toggleSort = useCallback((key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => d === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }, [sortKey]);

    const SortIcon = ({field}: { field: SortKey }) => {
        if (sortKey !== field) return null;
        return sortDir === "asc"
            ? <ArrowUpIcon className="size-3 inline"/>
            : <ArrowDownIcon className="size-3 inline"/>;
    };

    return (
        <>
            <h1>Home</h1>

            <div className="flex flex-col gap-4">

                {/* Cost Summary */}
                {totalMonthlyCosts > 0 && (
                    <div className="flex flex-col gap-4 pt-4">
                        <div className="flex gap-4">
                            <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                                <div className="text-sm text-zinc-500 dark:text-zinc-400">Monthly</div>
                                <div className="text-xl font-semibold text-zinc-950 dark:text-white">
                                    {formatCurrency(totalMonthlyCosts, mainCurrency)}
                                </div>
                                {Object.entries(otherCurrencyCosts).map(([cur, amount]) => (
                                    <div key={cur} className="text-sm text-zinc-500 dark:text-zinc-400">
                                        + {formatCurrency(amount, cur)}
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                                <div className="text-sm text-zinc-500 dark:text-zinc-400">Yearly</div>
                                <div className="text-xl font-semibold text-zinc-950 dark:text-white">
                                    {formatCurrency(totalMonthlyCosts * 12, mainCurrency)}
                                </div>
                                {Object.entries(otherCurrencyCosts).map(([cur, amount]) => (
                                    <div key={cur} className="text-sm text-zinc-500 dark:text-zinc-400">
                                        + {formatCurrency(amount * 12, cur)}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Category Breakdown */}
                        {costsByCategory.length > 0 && (
                            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">By Category</div>
                                <div className="flex flex-col gap-1">
                                    {costsByCategory.map(([category, amount]) => {
                                        const percentage = totalMonthlyCosts > 0 ? (amount / totalMonthlyCosts) * 100 : 0;
                                        return (
                                            <div key={category} className="flex items-center gap-2">
                                                <span
                                                    className="text-sm text-zinc-950 dark:text-white w-48 truncate">{category}</span>
                                                <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                                                    <div
                                                        className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-300"
                                                        style={{width: `${percentage}%`}}
                                                    />
                                                </div>
                                                <span
                                                    className="text-sm text-zinc-500 dark:text-zinc-400 w-28 text-right">
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

                {/* Search + Filters */}
                <div className="flex flex-col gap-2 pt-2 pb-4">
                    <div className="flex gap-2">
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
                        <Button className="self-end hover:cursor-pointer" to="/contracts/add">
                            <PlusIcon/>
                            <span className="hidden lg:block">Add Contract</span>
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <Select
                            className="w-auto text-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value={ContractStatusActive}>Active</option>
                            <option value={ContractStatusCancelled}>Cancelled</option>
                            <option value={ContractStatusExpired}>Expired</option>
                        </Select>

                        <Select
                            className="w-auto text-sm"
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                        >
                            <option value="all">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </Select>

                        <div className="hidden lg:flex gap-1 items-center ml-auto text-sm text-zinc-500 dark:text-zinc-400">
                            <span>Sort:</span>
                            <button onClick={() => toggleSort("name")}
                                    className={classNames("px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", sortKey === "name" ? "font-semibold text-zinc-950 dark:text-white" : "")}>
                                Name <SortIcon field="name"/>
                            </button>
                            <button onClick={() => toggleSort("costs")}
                                    className={classNames("px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", sortKey === "costs" ? "font-semibold text-zinc-950 dark:text-white" : "")}>
                                Costs <SortIcon field="costs"/>
                            </button>
                            <button onClick={() => toggleSort("next_billing_date")}
                                    className={classNames("px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", sortKey === "next_billing_date" ? "font-semibold text-zinc-950 dark:text-white" : "")}>
                                Next Billing <SortIcon field="next_billing_date"/>
                            </button>
                            <button onClick={() => toggleSort("status")}
                                    className={classNames("px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800", sortKey === "status" ? "font-semibold text-zinc-950 dark:text-white" : "")}>
                                Status <SortIcon field="status"/>
                            </button>
                        </div>

                        <a
                            href={`${apiBasePath}/contracts/export.csv`}
                            download
                            className="ml-auto lg:ml-0"
                        >
                            <Button plain className="hover:cursor-pointer">
                                <ArrowDownTrayIcon/>
                                <span className="hidden lg:block">CSV</span>
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Contract List */}
                <ul className="flex flex-col">
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
                                        <span
                                            className="truncate text-base/6 font-semibold text-zinc-950 dark:text-white">{contract.name}</span>
                                        <Badge color={statusColor(contract.status)} className="shrink-0 text-xs">
                                            {contract.status}
                                        </Badge>
                                    </div>
                                    <div className="text-sm/6 text-zinc-500 dark:text-zinc-400">
                                        {contract.company}
                                    </div>
                                </div>

                                {contract.costs &&
                                    <Badge className="shrink-0">{formatCurrency(contract.costs, contract.currency) + (contract.billing_period ? ` ${billingPeriodShorthand(contract.billing_period)}` : '')}</Badge>}
                                <ChevronRightIcon className={"h-5 w-5 shrink-0 text-zinc-950 dark:text-white"}/>
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
        </>
    )
}
