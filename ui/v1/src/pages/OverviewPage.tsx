import {type ComponentType, type ReactNode, type SVGProps, useMemo, useState} from "react";
import {NavLink, useSearchParams} from "react-router";
import {Trans, useTranslation} from "react-i18next";
import {
    ArrowDownIcon,
    ArrowsRightLeftIcon,
    ArrowUpIcon,
    BanknotesIcon,
    BuildingLibraryIcon,
    ChartBarIcon,
    MinusIcon,
    PlusIcon,
    ShoppingBagIcon,
    UserGroupIcon,
    UserIcon,
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
    AccountTypeDepot,
    BillingPeriodOneTime,
    EntryKindExpense,
    EntryKindIncome,
    EntryKindTransfer,
    type AccountDto,
} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {slotColor} from "../lib/icons.ts";
import {amountInMonth, attribution, summarizeMonth} from "../utils/budget.utils.ts";
import {accountOwnerLabel, daysUntil} from "../utils/household.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {card, cardTitle} from "../utils/ui.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {useAuth} from "../stores/useAuth.ts";
import dayjs from "../lib/dayjs";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** Largest categories shown individually (each in its own colour); the rest folds into "other". */
const CATEGORY_SLOTS = 7;
const SAVINGS_COLOR = "var(--chart-6)";
const BUDGET_COLOR = "var(--chart-7)";

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

function ShareBar({share}: { share: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 w-9">{Math.round(share * 100)} %</span>
            <div className="h-1.5 grow rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full" style={{width: `${Math.min(100, share * 100)}%`, background: "var(--chart-1)"}}/>
            </div>
        </div>
    );
}

function Delta({current, previous, previousLabel}: { current: number; previous: number; previousLabel: string }) {
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
                up ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                    : down ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>
                <IconCmp className="size-3"/>{percent} %
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">{t('overview.vs', {month: previousLabel})}</span>
        </div>
    );
}

function accountIcon(a: AccountDto): Icon {
    if (a.type === AccountTypeDepot) return ChartBarIcon;
    if (a.is_savings) return BanknotesIcon;
    return a.person_id == null ? BuildingLibraryIcon : WalletIcon;
}

export default function OverviewPage() {
    const {contracts, persons, accounts, categories, goals} = useAppData();
    const {month, monthKey, mode, setMode} = useMonth();
    const {mainCurrency} = usePreferences();
    const {t} = useTranslation();
    const {user} = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const categoryOf = (id?: number | null) => categories.find((c) => c.id === id);
    const [quickKind, setQuickKind] = useState<string | null>(null);
    const [recurringFilter, setRecurringFilter] = useState("all");

    const me = persons.find((p) => p.user_id != null && p.user_id === user?.id);
    const personal = searchParams.get("scope") === "me" && me != null;
    const personId = personal ? me?.id : undefined;
    const household = persons.filter((p) => p.in_household);

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
        () => summarizeMonth(contracts, persons, accounts, month, mode, mainCurrency, personId),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [contracts, persons, accounts, monthKey, mode, mainCurrency, personId],
    );
    const previous = useMemo(
        () => summarizeMonth(contracts, persons, accounts, month.subtract(1, "month"), mode, mainCurrency, personId),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [contracts, persons, accounts, monthKey, mode, mainCurrency, personId],
    );

    // Categories: fixed slots for the largest ones, the rest folds into "other"
    const categorySegments: DonutSegment[] = useMemo(() => {
        const top = summary.byCategory.slice(0, CATEGORY_SLOTS);
        const rest = summary.byCategory.slice(CATEGORY_SLOTS).reduce((sum, c) => sum + c.amount, 0);
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
        const targets: SankeyNode[] = categorySegments.map((s) => ({...s, key: `cat:${s.key}`}));
        if (summary.savings > 0) targets.push({key: "savings", label: t('overview.saving'), value: summary.savings, color: SAVINGS_COLOR});
        if (summary.freeBudgets > 0) targets.push({key: "budgets", label: t('overview.freeBudgets'), value: summary.freeBudgets, color: BUDGET_COLOR});
        if (summary.unallocated > 0) targets.push({key: "rest", label: t('overview.unallocated'), value: summary.unallocated, color: "var(--chart-other)"});
        if (summary.unallocated < 0) sources.push({key: "deficit", label: t('overview.deficit'), value: -summary.unallocated, color: "var(--chart-8)"});
        return {sources, targets};
    }, [summary, categorySegments, t]);

    // cancellation deadlines in the next 60 days
    const deadlines = useMemo(() => contracts
        .filter((c) => c.cancel_by && daysUntil(c.cancel_by) >= 0 && daysUntil(c.cancel_by) <= 60)
        .sort((a, b) => (a.cancel_by ?? "").localeCompare(b.cancel_by ?? "")), [contracts]);

    const upcoming = useMemo(() => {
        const today = dayjs().startOf("day");
        return contracts
            .filter((c) => c.kind === EntryKindExpense && c.next_billing_date && c.status !== "expired"
                && !dayjs(c.next_billing_date).isAfter(today.add(31, "day")))
            .sort((a, b) => (a.next_billing_date ?? "").localeCompare(b.next_billing_date ?? ""))
            .slice(0, 6);
    }, [contracts]);

    const recurring = useMemo(() => contracts
        .filter((c) => c.kind === EntryKindExpense && c.billing_period !== BillingPeriodOneTime
            && amountInMonth(c, month, "average") > 0)
        .filter((c) => {
            if (recurringFilter === "all") return true;
            const parts = attribution(c, persons, accounts);
            const members = parts ? [...parts.keys()].filter((id) => household.some((p) => p.id === id)) : [];
            if (recurringFilter === "shared") return !parts || members.length > 1;
            return parts?.has(Number(recurringFilter)) ?? false;
        })
        .sort((a, b) => (b.monthly_amount ?? 0) - (a.monthly_amount ?? 0)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [contracts, persons, accounts, monthKey, recurringFilter]);

    const flowByAccount = new Map(summary.accounts.map((f) => [f.account.id, f.inflow - f.outflow]));
    const sharedCosts = summary.byPerson.find((p) => p.key === "shared")?.amount ?? 0;
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
            />

            {/* Header */}
            <div className="flex flex-wrap items-end gap-4">
                <div className="grow">
                    <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">
                        {t('overview.hello', {name: me?.name ?? user?.username ?? ""})}
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {personal
                            ? t('overview.subtitleMe', {month: month.format("MMMM YYYY")})
                            : t('overview.subtitleHousehold', {month: month.format("MMMM YYYY")})}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 -mt-2">
                <SegmentedControl
                    value={personal ? "me" : "household"}
                    onChange={(scope) => update({scope})}
                    options={[
                        {value: "household", label: t('overview.scopeHousehold')},
                        {value: "me", label: me ? me.name : t('overview.scopeMe'), disabled: !me,
                            title: me ? undefined : t('overview.linkLoginHint')},
                    ]}
                />
                <SegmentedControl
                    value={mode}
                    onChange={setMode}
                    options={[
                        {value: "average", label: t('overview.modeAverage')},
                        {value: "due", label: t('overview.modeDue')},
                    ]}
                />
            </div>

            {needsSetup && (
                <div className={classNames(card, "bg-zinc-50 dark:bg-zinc-800/40")}>
                    <div className="text-sm text-zinc-950 dark:text-white font-medium">{t('overview.setupTitle')}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        <Trans i18nKey="overview.setupText" components={{link: <NavLink to="/household" className="underline"/>}}/>
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard icon={ShoppingBagIcon} tint="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                         label={personal ? t('overview.myCosts') : t('overview.ourCosts')} value={formatShort(summary.expenses)}>
                    <Delta current={summary.expenses} previous={previous.expenses}
                           previousLabel={month.subtract(1, "month").format("MMMM")}/>
                </KpiCard>
                {personal ? (
                    <>
                        <KpiCard icon={BanknotesIcon} tint="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                                 label={t('overview.income')} value={formatShort(summary.income)}/>
                        <KpiCard icon={ChartBarIcon} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                                 label={t('overview.saving')} value={formatShort(summary.savings)}/>
                        <KpiCard icon={WalletIcon} tint="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                 label={t('overview.unallocated')} value={formatShort(summary.unallocated)}/>
                    </>
                ) : (
                    <>
                        {household.slice(0, 2).map((p) => {
                            const amount = summary.byPerson.find((b) => b.key === String(p.id))?.amount ?? 0;
                            return (
                                <KpiCard key={p.id} icon={UserIcon}
                                         tint="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                                         label={p.id === me?.id ? t('overview.yourCosts') : t('overview.costsOf', {name: p.name})}
                                         value={formatShort(amount)}>
                                    <ShareBar share={summary.expenses > 0 ? amount / summary.expenses : 0}/>
                                </KpiCard>
                            );
                        })}
                        <KpiCard icon={UserGroupIcon} tint="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                                 label={t('overview.sharedCosts')} value={formatShort(sharedCosts)}>
                            <ShareBar share={summary.expenses > 0 ? sharedCosts / summary.expenses : 0}/>
                        </KpiCard>
                    </>
                )}
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
                                {t('overview.flowSummary', {income: format(summary.income), rest: format(summary.unallocated)})}
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
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <div className={cardTitle}>{t('overview.recurring')}</div>
                            <SegmentedControl
                                value={recurringFilter}
                                onChange={setRecurringFilter}
                                options={[
                                    {value: "all", label: t('savings.all')},
                                    {value: "shared", label: t('common.shared')},
                                    ...household.map((p) => ({value: String(p.id), label: p.name})),
                                ]}
                            />
                            <button onClick={() => setQuickKind(EntryKindExpense)}
                                    className="ml-auto text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline hover:cursor-pointer">
                                {t('overview.newExpense')}
                            </button>
                        </div>
                        <EntryTable entries={recurring} data={{contracts, persons, accounts, categories, goals}}
                                    columns={["split", "category"]} emptyText={t('overview.nothing')}/>
                    </div>
                </div>

                {/* Side column */}
                <div className="flex flex-col gap-6 min-w-0">
                    {deadlines.length > 0 && (
                        <div className={card}>
                            <div className="flex items-baseline justify-between mb-3">
                                <div className={cardTitle}>{t('contracts.deadlinesCard')}</div>
                                <NavLink to="/contracts" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('overview.showAll')}</NavLink>
                            </div>
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
                        </div>
                    )}

                    <div className={card}>
                        <div className="flex items-baseline justify-between mb-3">
                            <div className={cardTitle}>{t('overview.upcoming')}</div>
                            <NavLink to="/entries" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('overview.showAll')}</NavLink>
                        </div>
                        {upcoming.length === 0 && <div className="text-sm text-zinc-400 dark:text-zinc-500">{t('overview.nothing')}</div>}
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
                    </div>

                    <div className={card}>
                        <div className="flex items-baseline justify-between mb-3">
                            <div className={cardTitle}>{t('overview.accounts')}</div>
                            <NavLink to="/household" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('overview.showAll')}</NavLink>
                        </div>
                        <ul className="flex flex-col gap-3">
                            {accounts
                                .filter((a) => !personal || a.person_id === personId)
                                .map((a) => {
                                    const IconCmp = accountIcon(a);
                                    const flow = flowByAccount.get(a.id) ?? 0;
                                    return (
                                        <li key={a.id} className="flex items-center gap-3">
                                            <div className="size-9 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                                                <IconCmp className="size-4"/>
                                            </div>
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

                    {summary.budgets.length > 0 && (
                        <div className={card}>
                            <div className={classNames(cardTitle, "mb-3")}>{t('overview.budgets')}</div>
                            <div className="flex flex-col gap-4">
                                {summary.budgets.map(({person, budget, spent}) => (
                                    <div key={person.id}>
                                        <div className="flex items-baseline gap-2 text-sm">
                                            <span className="text-zinc-950 dark:text-white grow">{person.name}</span>
                                            <span className={classNames("font-semibold tabular-nums",
                                                budget - spent < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-950 dark:text-white")}>
                                                {format(budget - spent)}
                                            </span>
                                            <span className="text-xs text-zinc-400 dark:text-zinc-500">{t('overview.free')}</span>
                                        </div>
                                        <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                            <div className="h-full rounded-full" style={{
                                                width: `${budget > 0 ? Math.min(100, spent / budget * 100) : 100}%`,
                                                background: BUDGET_COLOR,
                                            }}/>
                                        </div>
                                        <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 tabular-nums">
                                            {t('overview.budgetLine', {spent: format(spent), budget: format(budget)})}
                                        </div>
                                    </div>
                                ))}
                            </div>
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
