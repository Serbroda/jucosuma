import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {ArrowTrendingDownIcon, ArrowTrendingUpIcon} from "@heroicons/react/16/solid";
import IconTile from "./ui/IconTile.tsx";
import DonutChart from "./charts/DonutChart.tsx";
import StackedBars from "./charts/StackedBars.tsx";
import type {AppData} from "../hooks/useAppData.ts";
import {variableCostsYear} from "../utils/closing.utils.ts";
import {categoryLabel} from "../utils/household.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {slotColor} from "../lib/icons.ts";
import {card, cardTitle, table, td, th, tr} from "../utils/ui.ts";
import dayjs from "../lib/dayjs";
import SortableTh from "./ui/SortableTh.tsx";
import {useSort} from "../utils/sort.utils.ts";

/** Actual variable costs of the last 12 months: shares, monthly bars and a suggested budget per category. */
export default function VariableCostsYear({data, mainCurrency, format}: {
    data: AppData;
    mainCurrency: string;
    format: (v: number, digits?: number) => string;
}) {
    const {t} = useTranslation();
    const year = useMemo(() => variableCostsYear(dayjs(), data.closings, data.contracts, data.persons, data.accounts, data.categories, mainCurrency),
        [data, mainCurrency]);
    const {sorted, sort, toggle} = useSort("variableYear", year.categories, {
        category: (c) => categoryLabel(c.category.name, c.category.key),
        average: (c) => c.average,
        plan: (c) => c.plan,
        trend: (c) => c.trend,
        recommendation: (c) => c.recommendation,
    });

    if (year.categories.length === 0) {
        return (
            <div className={card + " text-center py-10"}>
                <div className="font-medium text-zinc-950 dark:text-white">{t('closing.yearEmptyTitle')}</div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">{t('closing.yearEmptyText')}</p>
            </div>
        );
    }

    const color = (c: { color?: number | null }) => slotColor(c.color);
    const series = year.categories.map(({category}) => ({key: String(category.id), label: categoryLabel(category.name, category.key), color: color(category)}));
    const columns = year.months.map((m, i) => ({key: m.month.format("YYYY-MM"), label: m.month.format("MMM"), values: m.values, highlight: i === 11}));
    const perMonth = year.trackedMonths ? year.total / year.trackedMonths : 0;
    const planTotal = year.categories.reduce((s, c) => s + c.plan, 0);
    const recommendedTotal = year.categories.reduce((s, c) => s + c.recommendation, 0);

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={card}>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('closing.yearTotal')}</div>
                    <div className="text-2xl font-semibold text-zinc-950 dark:text-white mt-1">{format(year.total)}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{t('closing.yearTracked', {count: year.trackedMonths})}</div>
                </div>
                <div className={card}>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('closing.yearAverage')}</div>
                    <div className="text-2xl font-semibold text-zinc-950 dark:text-white mt-1">{format(perMonth)}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{t('closing.yearPlanNow', {amount: format(planTotal)})}</div>
                </div>
                <div className={card}>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('closing.yearRecommended')}</div>
                    <div className="text-2xl font-semibold text-zinc-950 dark:text-white mt-1">{format(recommendedTotal)}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{t('closing.yearPerMonth')}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className={card}>
                    <div className={cardTitle + " mb-3"}>{t('closing.yearShares')}</div>
                    <DonutChart
                        segments={year.categories.map(({category, total}) => ({
                            key: String(category.id), label: categoryLabel(category.name, category.key), value: total, color: color(category),
                        }))}
                        centerValue={format(year.total)}
                        centerLabel={t('closing.yearCenter')}
                        format={(v) => format(v, 2)}
                        emptyText=""
                    />
                </div>
                <div className={card + " min-w-0"}>
                    <div className={cardTitle + " mb-2"}>{t('closing.yearMonthly')}</div>
                    <StackedBars series={series} columns={columns} format={(v) => format(v, 2)} reference={{
                        label: t('closing.planned'),
                        values: Object.fromEntries(year.months.map((m) => [m.month.format("YYYY-MM"), m.planned])),
                    }}/>
                </div>
            </div>

            <div className={card}>
                <div className={cardTitle}>{t('closing.yearTrendTitle')}</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-3">{t('closing.yearTrendHint')}</p>
                <div className="overflow-x-auto -mx-5">
                    <table className={table}>
                        <thead>
                        <tr>
                            <SortableTh sortKey="category" sort={sort} onSort={toggle} className={th + " pl-5"}>{t('entry.category')}</SortableTh>
                            <SortableTh sortKey="average" sort={sort} onSort={toggle} className={th + " text-right hidden sm:table-cell"} align="right">{t('closing.yearAvg')}</SortableTh>
                            <SortableTh sortKey="plan" sort={sort} onSort={toggle} className={th + " text-right"} align="right">{t('closing.yearPlan')}</SortableTh>
                            <SortableTh sortKey="trend" sort={sort} onSort={toggle} className={th + " text-right hidden sm:table-cell"} align="right">{t('closing.yearTrend')}</SortableTh>
                            <SortableTh sortKey="recommendation" sort={sort} onSort={toggle} className={th + " text-right pr-5"} align="right">{t('closing.yearSuggestion')}</SortableTh>
                        </tr>
                        </thead>
                        <tbody>
                        {sorted.map((c) => {
                            const off = c.plan > 0 ? Math.abs(c.recommendation - c.plan) / c.plan > 0.1 : c.recommendation > 0;
                            return (
                                <tr key={c.category.id} className={tr}>
                                    <td className={td + " pl-5"}>
                                        <div className="flex items-center gap-3">
                                            <IconTile icon={c.category.icon} color={c.category.color} className="size-7"/>
                                            <div className="min-w-0">
                                                <div className="font-medium text-zinc-950 dark:text-white truncate">{categoryLabel(c.category.name, c.category.key)}</div>
                                                <div className="text-xs text-zinc-400 dark:text-zinc-500">
                                                    {t('closing.yearShareOf', {percent: Math.round(c.total / year.total * 100), count: c.months})}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={td + " text-right tabular-nums hidden sm:table-cell"}>{format(c.average)}</td>
                                    <td className={td + " text-right tabular-nums"}>{c.plan > 0 ? format(c.plan) : "–"}</td>
                                    <td className={td + " text-right hidden sm:table-cell"}>
                                        {c.trend == null ? <span className="text-xs text-zinc-400 dark:text-zinc-500">{t('closing.yearTrendNone')}</span> : (
                                            <span className={classNames("inline-flex items-center gap-1 tabular-nums text-sm",
                                                Math.abs(c.trend) < 0.05 ? "text-zinc-500 dark:text-zinc-400"
                                                    : c.trend > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                                                {Math.abs(c.trend) >= 0.05 && (c.trend > 0 ? <ArrowTrendingUpIcon className="size-4"/> : <ArrowTrendingDownIcon className="size-4"/>)}
                                                {c.trend > 0 ? "+" : ""}{Math.round(c.trend * 100)} %
                                            </span>
                                        )}
                                    </td>
                                    <td className={td + " text-right pr-5"}>
                                        <div className="font-semibold tabular-nums text-zinc-950 dark:text-white">{format(c.recommendation)}</div>
                                        {off && (
                                            <div className="text-xs text-amber-700 dark:text-amber-400">
                                                {c.recommendation > c.plan ? t('closing.yearRaise') : t('closing.yearLower')}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
