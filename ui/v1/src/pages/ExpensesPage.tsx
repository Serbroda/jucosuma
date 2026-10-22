import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowDownIcon, ArrowUpIcon, MagnifyingGlassIcon, MinusIcon, PlusIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import EntryTable from "../components/EntryTable.tsx";
import QuickEntryDialog from "../components/QuickEntryDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Input, InputGroup} from "../components/catalyst/input.tsx";
import {EntryKindExpense} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {amountInMonth} from "../utils/budget.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {card, cardTitle} from "../utils/ui.ts";

type Filter = "all" | "fixed" | "variable";

export default function ExpensesPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {month, mode} = useMonth();
    const {mainCurrency} = usePreferences();
    const [filter, setFilter] = useState<Filter>("all");
    const [search, setSearch] = useState("");
    const [adding, setAdding] = useState(false);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const expenses = data.contracts.filter((c) => c.kind === EntryKindExpense);
    const householdTotal = (m: typeof month) => expenses
        .filter((c) => !c.currency || c.currency === mainCurrency)
        .reduce((sum, c) => sum + amountInMonth(c, m, mode) * c.household_share, 0);
    const total = householdTotal(month);
    const previous = householdTotal(month.subtract(1, "month"));
    const change = previous > 0 ? (total - previous) / previous : 0;

    const term = search.trim().toLowerCase();
    const listed = expenses
        .filter((c) => amountInMonth(c, month, "average") > 0)
        // fixed costs are contracts, everything else (budgets, one-off purchases) is variable
        .filter((c) => filter === "all" || (filter === "variable") === !c.is_contract)
        .filter((c) => !term || c.name.toLowerCase().includes(term) || (c.company ?? "").toLowerCase().includes(term))
        .sort((a, b) => amountInMonth(b, month, "average") - amountInMonth(a, month, "average"));

    return (
        <div className="flex flex-col gap-6">
            <QuickEntryDialog isOpen={adding} initialKind={EntryKindExpense} onClose={() => setAdding(false)}
                              persons={data.persons} accounts={data.accounts} categories={data.categories} goals={data.goals}/>
            <div className="flex flex-wrap items-start gap-4">
                <div className="grow flex flex-col gap-4">
                    <PageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')}/>
                    <div>
                        <Button onClick={() => setAdding(true)} className="hover:cursor-pointer"><PlusIcon/>{t('expenses.add')}</Button>
                    </div>
                </div>
                <div className={card + " min-w-64"}>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('expenses.totalIn', {month: month.format("MMMM YYYY")})}</div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-3xl font-semibold text-zinc-950 dark:text-white">{format(total)}</span>
                        {previous > 0 && (
                            <span className={classNames("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
                                change > 0.005 ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                    : change < -0.005 ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>
                                {change > 0.005 ? <ArrowUpIcon className="size-3"/>
                                    : change < -0.005 ? <ArrowDownIcon className="size-3"/> : <MinusIcon className="size-3"/>}
                                {Math.round(Math.abs(change) * 100)} %
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{t('expenses.householdShareHint')}</div>
                </div>
            </div>

            <div className={card}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className={cardTitle}>{t('expenses.listTitle')}</div>
                    <SegmentedControl value={filter} onChange={setFilter} options={[
                        {value: "all", label: t('savings.all')},
                        {value: "fixed", label: t('expenses.fixed')},
                        {value: "variable", label: t('expenses.variable')},
                    ]}/>
                    <div className="ml-auto w-full sm:w-64">
                        <InputGroup>
                            <MagnifyingGlassIcon/>
                            <Input type="search" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)}/>
                        </InputGroup>
                    </div>
                </div>
                <EntryTable entries={listed} data={data} columns={["interval", "account", "split", "category"]}
                            emptyText={t('expenses.empty')}/>
            </div>
        </div>
    );
}
