import {type ComponentType, type ReactNode, type SVGProps, useMemo, useState} from "react";
import {NavLink, useNavigate, useSearchParams} from "react-router";
import {Trans, useTranslation} from "react-i18next";
import {
    ArrowDownIcon,
    ArrowsRightLeftIcon,
    ArrowUpIcon,
    BanknotesIcon,
    ChartBarIcon,
    ClipboardDocumentCheckIcon,
    MinusIcon,
    PlusIcon,
    ShoppingBagIcon,
    WalletIcon,
} from "@heroicons/react/20/solid";
import QuickEntryDialog from "../components/QuickEntryDialog.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import EntryIcon from "../components/EntryIcon.tsx";
import EntryTable from "../components/EntryTable.tsx";
import DeadlineBadge from "../components/ui/DeadlineBadge.tsx";
import DonutChart, {type DonutSegment} from "../components/charts/DonutChart.tsx";
import SankeyChart, {type SankeyNode} from "../components/charts/SankeyChart.tsx";
import {
    BillingPeriodOneTime,
    EntryKindExpense,
    EntryKindIncome,
    EntryKindTransfer,
} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {slotColor} from "../lib/icons.ts";
import {amountInMonth, potOf, type Scope, summarizeMonth} from "../utils/budget.utils.ts";
import {accountOwnerLabel, accountStyle, categoryLabel, daysUntil} from "../utils/household.utils.ts";
import IconTile from "../components/ui/IconTile.tsx";
import {compareMonth} from "../utils/closing.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {card, cardTitle} from "../utils/ui.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {useAuth} from "../stores/useAuth.ts";
import dayjs from "../lib/dayjs";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Largest categories shown individually (each in its own colour); the rest folds into "other". */
const CATEGORY_SLOTS = 8;
// reserved colours, so savings and transfers never look like a category
const SAVINGS_COLOR = "var(--chart-savings)";
const TRANSFER_COLOR = "var(--chart-transfer)";

function KpiCard({icon: IconCmp, tint, label, value, children}: {
    icon: Icon;
    tint: string;
    label: string;
    value: string;
    children?: ReactNode;
}) {
    return (
        <div className={classNames(card, "flex gap-4")}>
            <div className={classNames("size-10 shrink-0 rounded-lg flex items-center justify-center", tint)}>
                <IconCmp className="size-5"/>
            </div>
            <div className="min-w-0 grow">
                <div className="text-sm leading-snug text-zinc-500 dark:text-zinc-400">{label}</div>
                <div className="text-2xl font-semibold text-zinc-950 dark:text-white mt-0.5">{value}</div>
                {children && <div className="mt-2">{children}</div>}
            </div>
        </div>
    );
}

/** Change vs. the previous month; by default "up" is bad (costs), with upIsGood for income. */
function Delta({current, previous, previousLabel, upIsGood}: { current: number; previous: number; previousLabel: string; upIsGood?: boolean }) {
    const {t} = useTranslation();
    if (previous <= 0) return null;
    const change = (current - previous) / previous;
    const percent = Math.round(Math.abs(change) * 100);
    const up = change > 0.005;
    const down = change < -0.005;
    const IconCmp = up ? ArrowUpIcon : down ? ArrowDownIcon : MinusIcon;
    return (
        <div className="flex items-center gap-1.5 text-xs">
            <span className={classNames("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                (up && !upIsGood) || (down && upIsGood) ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                    : up || down ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>
                <IconCmp className="size-3"/>{percent} %
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">{t('overview.vs', {month: previousLabel})}</span>
        </div>
    );
}

export default function OverviewPage() {
    const data = useAppData();
    const {contracts, persons, accounts, categories, goals} = data;
    const {month, monthKey, mode} = useMonth();
    const navigate = useNavigate();
    const {mainCurrency} = usePreferences();
    const {t} = useTranslation();
    const {user} = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const categoryOf = (id?: number | null) => categories.find((c) => c.id === id);
    const [quickKind, setQuickKind] = useState<string | null>(null);

    const me = persons.find((p) => p.user_id != null && p.user_id === user?.id);
    const household = persons.filter((p) => p.in_household);
    // selected pot: household cash, one person's own money, or everything together
    const potParam = searchParams.get("pot");
    const scope: Scope = potParam === "all" ? "all"
        : potParam && household.some((p) => String(p.id) === potParam) ? Number(potParam) : "household";
    const scopePerson = typeof scope === "number" ? persons.find((p) => p.id === scope) : undefined;
    const potLabel = (key: string) => key === "household"
        ? t('overview.potHousehold') : persons.find((p) => String(p.id) === key)?.name ?? t('common.unknown');

    const format = (value: number, digits = 2) => new Intl.NumberFormat(numberLocale(), {
        style: "currency", currency: mainCurrency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
    const formatShort = (value: number) => format(value, Math.abs(value) >= 100 ? 0 : 2);

    const update = (changes: Record<string, string>) => {
        const next = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(changes)) next.set(k, v);
        setSearchParams(next, {replace: true});
    };

    const summary = useMemo(
        () => summarizeMonth(contracts, persons, accounts, month, mode, mainCurrency, scope),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [contracts, persons, accounts, monthKey, mode, mainCurrency, scope],
    );
    const previous = useMemo(
        () => summarizeMonth(contracts, persons, accounts, month.subtract(1, "month"), mode, mainCurrency, scope),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [contracts, persons, accounts, monthKey, mode, mainCurrency, scope],
    );
    // every pot of the household with its own balance
    const pots = useMemo(() => (["household", ...household.map((p) => p.id)] as Scope[]).map((pot) => ({
        pot, summary: summarizeMonth(contracts, persons, accounts, month, mode, mainCurrency, pot),
        // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [contracts, persons, accounts, monthKey, mode, mainCurrency]);
    const inflow = summary.income + summary.transfersIn;

    // monthly closing: reminder for last month and plan vs. actual of the selected month
    const lastMonth = dayjs().startOf("month").subtract(1, "month");
    const lastMonthOpen = accounts.length > 0 && !data.closings.some((c) => c.month === lastMonth.format("YYYY-MM"));
    const comparison = useMemo(() => compareMonth(month, data.closings, contracts, persons, accounts, categories, mainCurrency),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [data, monthKey, mainCurrency]);
    const potComparisons = comparison.pots.filter((p) => p.deviation != null && (scope === "all" || p.pot === scope));
    const scopeComparison = potComparisons.length ? {
        planned: potComparisons.reduce((s, p) => s + p.planned, 0),
        actual: potComparisons.reduce((s, p) => s + (p.actual ?? 0), 0),
        deviation: potComparisons.reduce((s, p) => s + (p.deviation ?? 0), 0),
    } : undefined;
    const openClosing = (m: typeof month) => navigate(`/closing?month=${m.format("YYYY-MM")}`);

    // Categories: fixed slots for the largest ones, the rest folds into "other"
    const categorySegments: DonutSegment[] = useMemo(() => {
        // a single remaining category is shown itself; folding only pays off for two or more
        const shown = summary.byCategory.length > CATEGORY_SLOTS + 1 ? CATEGORY_SLOTS : summary.byCategory.length;
        const top = summary.byCategory.slice(0, shown);
        const rest = summary.byCategory.slice(shown).reduce((sum, c) => sum + c.amount, 0);
        const segments = top.map((c) => ({key: c.id != null ? String(c.id) : c.name, label: c.label, value: c.amount, color: slotColor(categoryOf(c.id)?.color)}));
        if (rest > 0) segments.push({key: "__other", label: t('overview.otherCategories'), value: rest, color: "var(--chart-other)"});
        return segments;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [summary, categories, t]);

    const sankey = useMemo(() => {
        const incomeByName = new Map<string, number>();
        for (const e of summary.entries) {
            if (e.entry.kind === EntryKindIncome && e.own > 0) {
                incomeByName.set(e.entry.name, (incomeByName.get(e.entry.name) ?? 0) + e.own);
            }
        }
        const sources: SankeyNode[] = [...incomeByName.entries()]
            .sort(([, a], [, b]) => b - a)
            .map(([label, value]) => ({key: `in:${label}`, label, value, color: "var(--chart-neutral)"}));
        for (const [pot, value] of Object.entries(summary.transfersInBy)) {
            sources.push({key: `from:${pot}`, label: t('overview.fromPot', {pot: potLabel(pot)}), value, color: TRANSFER_COLOR});
        }
        const targets: SankeyNode[] = categorySegments.map((s) => ({...s, key: `cat:${s.key}`}));
        if (summary.savings > 0) targets.push({key: "savings", label: t('overview.saving'), value: summary.savings, color: SAVINGS_COLOR});
        // more spent from savings than saved: the difference comes from the savings
        if (summary.savings < 0) sources.push({key: "fromSavings", label: t('overview.fromSavingsNode'), value: -summary.savings, color: SAVINGS_COLOR});
        for (const [pot, value] of Object.entries(summary.transfersOutBy)) {
            targets.push({key: `to:${pot}`, label: t('overview.toPot', {pot: potLabel(pot)}), value, color: TRANSFER_COLOR});
        }
        if (summary.available > 0) targets.push({key: "rest", label: t('overview.available'), value: summary.available, color: "var(--chart-other)"});
        if (summary.available < 0) sources.push({key: "deficit", label: t('overview.deficit'), value: -summary.available, color: "var(--chart-8)"});
        return {sources, targets};
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [summary, categorySegments, t]);

    // cancellation deadlines in the next 60 days
    const deadlines = useMemo(() => contracts
        .filter((c) => c.cancel_by && daysUntil(c.cancel_by) >= 0 && daysUntil(c.cancel_by) <= 60)
        .sort((a, b) => (a.cancel_by ?? "").localeCompare(b.cancel_by ?? "")), [contracts]);

    // the "soon" card opens on deadlines when one is due within 30 days
    const [soonTab, setSoonTab] = useState<"payments" | "deadlines">(
        () => deadlines.some((c) => daysUntil(c.cancel_by!) <= 30) ? "deadlines" : "payments");

    const upcoming = useMemo(() => {
        const today = dayjs().startOf("day");
        return contracts
            .filter((c) => c.kind === EntryKindExpense && c.next_billing_date && c.status !== "expired"
                && !dayjs(c.next_billing_date).isAfter(today.add(31, "day"))
                && (scope === "all" || potOf(accounts.find((a) => a.id === c.account_id)) === scope))
            .sort((a, b) => (a.next_billing_date ?? "").localeCompare(b.next_billing_date ?? ""))
            .slice(0, 6);
    }, [contracts, accounts, scope]);

    const recurring = useMemo(() => contracts
        .filter((c) => c.kind === EntryKindExpense && c.billing_period !== BillingPeriodOneTime
            && amountInMonth(c, month, "average") > 0)
        .sort((a, b) => (b.monthly_amount ?? 0) - (a.monthly_amount ?? 0)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [contracts, monthKey]);

    const flowByAccount = new Map(summary.accounts.map((f) => [f.account.id, f.inflow - f.outflow]));
    const shortDate = (d: string) => new Intl.DateTimeFormat(numberLocale(), {day: "numeric", month: "short"}).format(new Date(d));
    const needsSetup = persons.length === 0 || accounts.length === 0;

    return (
        <div className="flex flex-col gap-6">
            <QuickEntryDialog
                isOpen={quickKind != null}
                initialKind={quickKind ?? undefined}
                onClose={() => setQuickKind(null)}
                persons={persons}
                accounts={accounts}
                categories={categories}
                goals={goals}
                contracts={contracts}
            />

            {/* Header */}
            <div className="flex flex-wrap items-end gap-4">
                <div className="grow">
                    <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">
                        {t('overview.hello', {name: me?.name ?? user?.username ?? ""})}
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {scopePerson ? t('overview.subtitlePerson', {name: scopePerson.name, month: month.format("MMMM YYYY")})
                            : scope === "all" ? t('overview.subtitleAll', {month: month.format("MMMM YYYY")})
                                : t('overview.subtitleHousehold', {month: month.format("MMMM YYYY")})}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 -mt-2">
                <SegmentedControl
                    value={String(scope)}
                    onChange={(pot) => update({pot})}
                    options={[
                        {value: "household", label: t('overview.potHousehold')},
                        ...household.map((p) => ({value: String(p.id), label: p.name})),
                        {value: "all", label: t('overview.potAll')},
                    ]}
                />
            </div>

            {lastMonthOpen && (
                <div className="-mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-2.5 text-sm text-blue-800 dark:text-blue-300">
                    <ClipboardDocumentCheckIcon className="size-5 shrink-0"/>
                    <span className="grow">{t('closing.bannerOpen', {month: lastMonth.format("MMMM")})}</span>
                    <button onClick={() => openClosing(lastMonth)} className="font-medium underline hover:cursor-pointer">
                        {t('closing.bannerAction')}
                    </button>
                </div>
            )}

            {summary.unassignedAccount > 0 && (
                <div role="status" className="-mt-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                    {t('overview.unassignedHint', {count: summary.unassignedAccount})}
                </div>
            )}

            {needsSetup && (
                <div className={classNames(card, "bg-zinc-50 dark:bg-zinc-800/40")}>
                    <div className="text-sm text-zinc-950 dark:text-white font-medium">{t('overview.setupTitle')}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        <Trans i18nKey="overview.setupText" components={{link: <NavLink to="/household" className="underline"/>}}/>
                    </div>
                </div>
            )}

            {/* KPIs: money in → costs → savings → available */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard icon={BanknotesIcon} tint="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                         label={t('overview.income')} value={formatShort(inflow)}>
                    {summary.transfersIn > 0 && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('overview.inclTransfers', {amount: formatShort(summary.transfersIn)})}
                        </div>
                    )}
                    <div className="mt-1">
                        <Delta current={inflow} previous={previous.income + previous.transfersIn} upIsGood
                               previousLabel={month.subtract(1, "month").format("MMMM")}/>
                    </div>
                </KpiCard>
                <KpiCard icon={ShoppingBagIcon} tint="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                         label={t('overview.costs')} value={formatShort(summary.expenses)}>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t('overview.costsFixedVariable', {
                            fixed: formatShort(summary.expenses - summary.variableCosts),
                            variable: formatShort(summary.variableCosts),
                        })}
                    </div>
                    <div className="mt-1">
                        <Delta current={summary.expenses} previous={previous.expenses}
                               previousLabel={month.subtract(1, "month").format("MMMM")}/>
                    </div>
                </KpiCard>
                <KpiCard icon={ChartBarIcon} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                         label={t('overview.saving')} value={formatShort(summary.savings)}>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {summary.fromSavings > 0
                            ? t('overview.netSavings', {amount: formatShort(summary.fromSavings)})
                            : inflow > 0 ? t('overview.ofIncomeShort', {percent: Math.round(summary.savings / inflow * 100)}) : null}
                    </div>
                </KpiCard>
                <KpiCard icon={WalletIcon}
                         tint={summary.available < 0 ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                             : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}
                         label={t('overview.available')} value={formatShort(summary.available)}>
                    <div className={classNames("text-xs", summary.available < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400")}>
                        {inflow === 0 && summary.expenses > 0 ? t('overview.noInflowHint')
                            : summary.available < 0 ? t('overview.overspent')
                                : summary.transfersOut > 0 ? t('overview.availableHintTransfers', {amount: formatShort(summary.transfersOut)})
                                    : t('overview.availableHint')}
                    </div>
                </KpiCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                {/* Main column */}
                <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
                    <div className={card}>
                        <div className={classNames(cardTitle, "mb-4")}>{t('overview.byCategory')}</div>
                        <DonutChart
                            segments={categorySegments}
                            centerValue={formatShort(summary.expenses)}
                            centerLabel={t('overview.total')}
                            format={(v) => format(v)}
                            emptyText={t('overview.nothing')}
                        />
                    </div>

                    <div className={card}>
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-4">
                            <div className={cardTitle}>{t('overview.moneyFlow')}</div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                {t('overview.flowSummary', {income: format(inflow), rest: format(summary.available)})}
                            </div>
                        </div>
                        {sankey.sources.length === 0 ? (
                            <div className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">{t('overview.noIncome')}</div>
                        ) : (
                            <SankeyChart sources={sankey.sources} targets={sankey.targets}
                                         centerLabel={t('overview.budgetNode')} format={(v) => format(v)}/>
                        )}
                    </div>

                    <div className={card}>
                        <EntryTable entries={recurring} data={data} columns={["split", "category"]} emptyText={t('overview.nothing')} perMonth={month}
                                    title={t('overview.recurring')}
                                    controls={
                                        <button onClick={() => setQuickKind(EntryKindExpense)}
                                                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline hover:cursor-pointer">
                                            {t('overview.newExpense')}
                                        </button>
                                    }/>
                    </div>
                </div>

                {/* Side column */}
                <div className="flex flex-col gap-6 min-w-0">
                    {(scopeComparison || comparison.categories.length > 0) && (
                        <div className={card}>
                            <div className="flex items-baseline justify-between mb-3">
                                <div className={cardTitle}>{t('closing.cardTitle')}</div>
                                <button onClick={() => openClosing(month)}
                                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline hover:cursor-pointer">
                                    {t('closing.cardMore')}
                                </button>
                            </div>
                            {scopeComparison && (
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{t('closing.cardPlanned')}</div>
                                        <div className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">{formatShort(scopeComparison.planned)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{t('closing.cardActual')}</div>
                                        <div className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">{formatShort(scopeComparison.actual)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{t('closing.deviation')}</div>
                                        <div className={classNames("text-sm font-semibold tabular-nums",
                                            scopeComparison.deviation < -0.5 ? "text-red-600 dark:text-red-400"
                                                : scopeComparison.deviation > 0.5 ? "text-green-700 dark:text-green-400" : "text-zinc-500")}>
                                            {scopeComparison.deviation > 0 ? "+" : ""}{formatShort(scopeComparison.deviation)}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {comparison.categories.slice(0, 3).map((c) => (
                                <div key={c.category.id} className="flex items-center justify-between text-xs mt-2 text-zinc-500 dark:text-zinc-400">
                                    <span className="truncate">{categoryLabel(c.category.name, c.category.key)}</span>
                                    <span className={classNames("tabular-nums font-medium", c.deviation > 0.5 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                                        {c.deviation > 0 ? "+" : ""}{formatShort(c.deviation)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* upcoming payments and cancellation deadlines in one card */}
                    <div className={card}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className={cardTitle}>{t('overview.soon')}</div>
                            <NavLink to={soonTab === "deadlines" ? "/contracts" : "/expenses"}
                                     className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('overview.showAll')}</NavLink>
                        </div>
                        <div className="mb-3">
                            <SegmentedControl value={soonTab} onChange={setSoonTab} options={[
                                {value: "payments", label: t('overview.soonPayments')},
                                {value: "deadlines", label: deadlines.length ? `${t('overview.soonDeadlines')} (${deadlines.length})` : t('overview.soonDeadlines')},
                            ]}/>
                        </div>
                        {soonTab === "payments" ? (
                            upcoming.length === 0 ? <div className="text-sm text-zinc-400 dark:text-zinc-500">{t('overview.nothing')}</div> : (
                            <ul className="flex flex-col gap-1">
                            {upcoming.map((c) => (
                                <li key={c.id}>
                                    <NavLink to={`/contracts/${c.id}`}
                                             className="flex items-center gap-3 py-1.5 -mx-2 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <EntryIcon name={c.name} icon={c.icon_source} category={categoryOf(c.category_id)} className="size-7"/>
                                        <span className="text-xs text-zinc-400 dark:text-zinc-500 w-14 shrink-0 tabular-nums">
                                            {shortDate(c.next_billing_date!)}
                                        </span>
                                        <span className="text-sm text-zinc-950 dark:text-white truncate grow">{c.name}</span>
                                        <span className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">{format(c.costs ?? 0)}</span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                            )
                        ) : (
                            deadlines.length === 0 ? <div className="text-sm text-zinc-400 dark:text-zinc-500">{t('overview.noDeadlines')}</div> : (
                            <ul className="flex flex-col gap-1">
                                {deadlines.map((c) => (
                                    <li key={c.id}>
                                        <NavLink to={`/contracts/${c.id}`}
                                                 className="flex items-center gap-3 py-1.5 -mx-2 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                            <EntryIcon name={c.name} icon={c.icon_source} category={categoryOf(c.category_id)} className="size-7"/>
                                            <span className="min-w-0 grow">
                                                <span className="block text-sm text-zinc-950 dark:text-white truncate">{c.name}</span>
                                                <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                                                    {t('contracts.cancelByShort', {date: dayjs(c.cancel_by).format("DD.MM.YYYY")})}
                                                </span>
                                            </span>
                                            <DeadlineBadge date={c.cancel_by!}/>
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                            )
                        )}
                    </div>

                    <div className={card}>
                        <div className="flex items-baseline justify-between mb-3">
                            <div className={cardTitle}>{t('overview.accounts')}</div>
                            <NavLink to="/accounts" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('overview.showAll')}</NavLink>
                        </div>
                        <ul className="flex flex-col gap-3">
                            {accounts
                                .filter((a) => scope === "all" || potOf(a) === scope)
                                .map((a) => {
                                    const style = accountStyle(a);
                                    const flow = flowByAccount.get(a.id) ?? 0;
                                    return (
                                        <li key={a.id} className="flex items-center gap-3">
                                            <IconTile icon={style.icon} color={style.color} className="size-9"/>
                                            <div className="min-w-0 grow">
                                                <div className="text-sm text-zinc-950 dark:text-white truncate">{a.name}</div>
                                                <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{accountOwnerLabel(a, persons)}</div>
                                            </div>
                                            <div className="text-right">
                                                {a.balance != null ? (
                                                    <>
                                                        <div className="text-sm font-medium tabular-nums text-zinc-950 dark:text-white">{format(a.balance)}</div>
                                                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{t('overview.balanceLabel')}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className={classNames("text-sm font-medium tabular-nums",
                                                            flow < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-950 dark:text-white")}>
                                                            {flow > 0 ? "+" : ""}{format(flow)}
                                                        </div>
                                                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{t('overview.perMonth')}</div>
                                                    </>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                        </ul>
                    </div>

                    {household.length > 0 && (
                        <div className={card}>
                            <div className={classNames(cardTitle, "mb-3")}>{t('overview.pots')}</div>
                            <ul className="flex flex-col gap-1">
                                {pots.map(({pot, summary: p}) => (
                                    <li key={String(pot)}>
                                        <button onClick={() => update({pot: String(pot)})}
                                                className={classNames("w-full flex items-center gap-3 rounded-lg -mx-2 px-2 py-2 text-left hover:cursor-pointer",
                                                    pot === scope ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50")}>
                                            <span className="min-w-0 grow">
                                                <span className="block text-sm font-medium text-zinc-950 dark:text-white">{potLabel(String(pot))}</span>
                                                <span className="block text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
                                                    {t('overview.potLine', {
                                                        in: formatShort(p.income + p.transfersIn),
                                                        out: formatShort(p.expenses + p.savings + p.transfersOut),
                                                    })}
                                                </span>
                                            </span>
                                            <span className={classNames("text-sm font-semibold tabular-nums",
                                                p.available < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-950 dark:text-white")}>
                                                {formatShort(p.available)}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">{t('overview.potsHint')}</p>
                        </div>
                    )}

                    <div className={card}>
                        <div className={classNames(cardTitle, "mb-3")}>{t('overview.quickAdd')}</div>
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                [EntryKindExpense, PlusIcon, t('kinds.expense'), "text-blue-600 dark:text-blue-400"],
                                [EntryKindIncome, BanknotesIcon, t('kinds.income'), "text-green-600 dark:text-green-400"],
                                [EntryKindTransfer, ArrowsRightLeftIcon, t('kinds.transfer'), "text-violet-600 dark:text-violet-400"],
                            ] as [string, Icon, string, string][]).map(([kind, IconCmp, label, color]) => (
                                <button key={kind} onClick={() => setQuickKind(kind)}
                                        className="flex flex-col items-center gap-1.5 rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-700 py-3 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:cursor-pointer">
                                    <IconCmp className={classNames("size-5", color)}/>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
