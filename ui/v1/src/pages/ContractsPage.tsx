import {useMemo, useState} from "react";
import {useNavigate, useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {CalendarDaysIcon, DocumentTextIcon, ShieldCheckIcon, ArrowTopRightOnSquareIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import RowActions from "../components/ui/RowActions.tsx";
import DeadlineBadge from "../components/ui/DeadlineBadge.tsx";
import CategoryBadge from "../components/ui/CategoryBadge.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import EntryIcon from "../components/EntryIcon.tsx";
import {Badge} from "../components/catalyst/badge.tsx";
import {ContractStatusActive, type ContractDto} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {splitText} from "../utils/budget.utils.ts";
import {daysUntil, isContractEntry, noticeLabel} from "../utils/household.utils.ts";
import {billingPeriodLabel} from "../utils/data.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {classNames, safeHref} from "../utils/dom.utils.ts";
import {sendJson} from "../lib/api.ts";
import {card, cardTitle, table, td, th, tr} from "../utils/ui.ts";
import dayjs from "../lib/dayjs";

type Filter = "insurance" | "all" | "cancelled";

/** Upcoming cancellation deadlines (or contract ends) within this many days are highlighted. */
const DEADLINE_WINDOW = 120;

export default function ContractsPage() {
    const data = useAppData();
    const {t, i18n} = useTranslation();
    const {mainCurrency} = usePreferences();
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const [filter, setFilter] = useState<Filter>("insurance");

    const format = (v: number, digits = 2) => new Intl.NumberFormat(numberLocale(), {
        style: "currency", currency: mainCurrency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(v);

    const insuranceIds = new Set(data.categories.filter((c) => c.key === "insurance"
        || /versicher|insurance/i.test(c.name)).map((c) => c.id));
    const isInsurance = (c: ContractDto) => c.category_id != null && insuranceIds.has(c.category_id);
    const contracts = useMemo(() => data.contracts.filter((c) => isContractEntry(c) && c.status !== "expired"),
        [data.contracts]);
    const listed = contracts
        .filter((c) => filter === "all" || (filter === "cancelled" ? c.status !== ContractStatusActive : isInsurance(c)))
        .sort((a, b) => (b.monthly_amount ?? 0) - (a.monthly_amount ?? 0));

    const yearly = (c: ContractDto) => (c.monthly_amount ?? 0) * 12;
    const insurances = contracts.filter(isInsurance);
    const insuranceYear = insurances.reduce((s, c) => s + yearly(c), 0);
    const contractsYear = contracts.reduce((s, c) => s + yearly(c), 0);

    const deadlines = contracts
        .map((c) => ({c, date: c.cancel_by ?? (c.status !== ContractStatusActive ? c.term_end : undefined)}))
        .filter((d): d is { c: ContractDto; date: string } =>
            !!d.date && daysUntil(d.date) >= 0 && daysUntil(d.date) <= DEADLINE_WINDOW)
        .sort((a, b) => a.date.localeCompare(b.date));
    const categoryOf = (c: ContractDto) => data.categories.find((cat) => cat.id === c.category_id);

    const kpis = [
        {label: t('contracts.insurancesPerYear'), value: format(insuranceYear, 0), hint: t('contracts.perMonth', {amount: format(insuranceYear / 12)}), icon: ShieldCheckIcon, color: 3},
        {label: t('contracts.contractsPerYear'), value: format(contractsYear, 0), hint: t('contracts.count', {count: contracts.length}), icon: DocumentTextIcon, color: 1},
        {label: t('contracts.deadlines'), value: String(deadlines.length), hint: t('contracts.deadlinesHint', {days: DEADLINE_WINDOW}), icon: CalendarDaysIcon, color: deadlines.length ? 8 : 6},
    ];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={t('contracts.title')} subtitle={t('contracts.subtitle')}/>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {kpis.map((k) => (
                    <div key={k.label} className={card + " flex items-center gap-4"}>
                        <IconTile iconComponent={k.icon} color={k.color} className="size-11"/>
                        <div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">{k.label}</div>
                            <div className="text-2xl font-semibold text-zinc-950 dark:text-white">{k.value}</div>
                            <div className="text-xs text-zinc-400 dark:text-zinc-500">{k.hint}</div>
                        </div>
                    </div>
                ))}
            </div>

            {deadlines.length > 0 && (
                <div className={card}>
                    <div className={cardTitle + " mb-3"}>{t('contracts.upcomingDeadlines')}</div>
                    <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                        {deadlines.map(({c, date}) => (
                            <li key={c.id}>
                                <button onClick={() => navigate(`/contracts/${c.id}`)}
                                        className="w-full flex flex-wrap items-center gap-3 py-2.5 text-left hover:cursor-pointer">
                                    <EntryIcon name={c.name} icon={c.icon_source} category={categoryOf(c)} className="size-8"/>
                                    <div className="grow min-w-0">
                                        <div className="text-sm font-medium text-zinc-950 dark:text-white truncate">{c.name}</div>
                                        <div className="text-xs text-zinc-400 dark:text-zinc-500">
                                            {c.cancel_by
                                                ? t('contracts.cancelByLine', {date: dayjs(date).format("DD.MM.YYYY"), end: dayjs(c.term_end).format("DD.MM.YYYY")})
                                                : t('contracts.endsLine', {date: dayjs(date).format("DD.MM.YYYY")})}
                                        </div>
                                    </div>
                                    <DeadlineBadge date={date}/>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className={card}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className={cardTitle}>{t('contracts.listTitle')}</div>
                    <SegmentedControl value={filter} onChange={setFilter} options={[
                        {value: "insurance", label: t('contracts.insurances', {count: insurances.length})},
                        {value: "all", label: t('contracts.all', {count: contracts.length})},
                        {value: "cancelled", label: t('contracts.cancelled')},
                    ]}/>
                </div>
                <div className="overflow-x-auto -mx-5">
                    <table className={table}>
                        <thead>
                        <tr>
                            <th className={classNames(th, "pl-5")}>{t('common.name')}</th>
                            <th className={classNames(th, "hidden lg:table-cell")}>{t('entryForm.contractNumber')}</th>
                            <th className={classNames(th, "hidden md:table-cell")}>{t('contracts.concerns')}</th>
                            <th className={classNames(th, "text-right")}>{t('contracts.premium')}</th>
                            <th className={classNames(th, "text-right hidden sm:table-cell")}>{t('contracts.perYear')}</th>
                            <th className={classNames(th, "hidden md:table-cell")}>{t('contracts.cancelBy')}</th>
                            {filter !== "insurance" && <th className={classNames(th, "hidden xl:table-cell")}>{t('entry.category')}</th>}
                            <th className={classNames(th, "w-10 pr-5")}/>
                        </tr>
                        </thead>
                        <tbody>
                        {listed.map((c) => (
                            <tr key={c.id} className={tr}>
                                <td className={classNames(td, "pl-5")}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <button onClick={() => navigate(`/contracts/${c.id}`)}
                                                className="flex items-center gap-3 min-w-0 text-left hover:cursor-pointer">
                                            <EntryIcon name={c.name} icon={c.icon_source} category={categoryOf(c)} className="size-8"/>
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium text-zinc-950 dark:text-white">{c.name}</span>
                                                <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">{c.company ?? "–"}</span>
                                            </span>
                                        </button>
                                        {safeHref(c.website) && (
                                            <a href={safeHref(c.website)} target="_blank" rel="noopener noreferrer"
                                               title={t('entryForm.website')} aria-label={t('entryForm.website')}
                                               className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white">
                                                <ArrowTopRightOnSquareIcon className="size-4"/>
                                            </a>
                                        )}
                                    </div>
                                </td>
                                <td className={classNames(td, "hidden lg:table-cell tabular-nums whitespace-nowrap")}>{c.contract_number ?? "–"}</td>
                                <td className={classNames(td, "hidden md:table-cell")}>
                                    {splitText(c, data.persons, data.accounts, t('common.household'), i18n.language)}
                                </td>
                                <td className={classNames(td, "text-right tabular-nums whitespace-nowrap")}>
                                    <div className="font-medium text-zinc-950 dark:text-white">{format(c.costs ?? 0)}</div>
                                    <div className="text-xs text-zinc-400 dark:text-zinc-500">{billingPeriodLabel(c.billing_period)}</div>
                                </td>
                                <td className={classNames(td, "text-right tabular-nums hidden sm:table-cell")}>{format(yearly(c))}</td>
                                <td className={classNames(td, "hidden md:table-cell")}>
                                    {c.status !== ContractStatusActive ? (
                                        <Badge color="yellow">{t('contracts.endsOnShort', {date: dayjs(c.term_end).format("DD.MM.YY")})}</Badge>
                                    ) : c.cancel_by ? (
                                        <div className="flex flex-col items-start gap-0.5">
                                            <span className="tabular-nums">{dayjs(c.cancel_by).format("DD.MM.YYYY")}</span>
                                            {daysUntil(c.cancel_by) <= DEADLINE_WINDOW && <DeadlineBadge date={c.cancel_by}/>}
                                        </div>
                                    ) : noticeLabel(c.notice_period, c.notice_unit) ? (
                                        <span className="text-xs">{t('contracts.anytime', {notice: noticeLabel(c.notice_period, c.notice_unit)})}</span>
                                    ) : (
                                        <span className="text-zinc-400 dark:text-zinc-500">–</span>
                                    )}
                                </td>
                                {filter !== "insurance" && (
                                    <td className={classNames(td, "hidden xl:table-cell")}>
                                        <CategoryBadge categoryId={c.category_id} fallbackName={c.category} categories={data.categories}/>
                                    </td>
                                )}
                                <td className={classNames(td, "pr-5 text-right")}>
                                    <RowActions onEdit={() => navigate(`/contracts/${c.id}/edit`)} onDelete={async () => {
                                        await sendJson("DELETE", `/contracts/${c.id}`);
                                        revalidator.revalidate();
                                    }}/>
                                </td>
                            </tr>
                        ))}
                        {listed.length === 0 && (
                            <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">{t('contracts.empty')}</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">{t('contracts.hint')}</p>
            </div>
        </div>
    );
}
