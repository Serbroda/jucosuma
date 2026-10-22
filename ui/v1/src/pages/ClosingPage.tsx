import {useMemo, useState} from "react";
import {useRevalidator, useSearchParams} from "react-router";
import {useTranslation} from "react-i18next";
import {CheckCircleIcon, ClipboardDocumentCheckIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import ClosingDialog from "../components/dialogs/ClosingDialog.tsx";
import ConfirmDialog from "../components/dialogs/ConfirmDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {useAppData} from "../hooks/useAppData.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {compareMonth} from "../utils/closing.utils.ts";
import {categoryLabel} from "../utils/household.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {sendJson} from "../lib/api.ts";
import {slotColor} from "../lib/icons.ts";
import {card, cardTitle, table, td, th, tr} from "../utils/ui.ts";
import dayjs from "../lib/dayjs";

/** Signed amount with colour: for balances more money (positive) is good, for costs less is good. */
function Deviation({value: raw, format, costs}: { value: number; format: (v: number) => string; costs?: boolean }) {
    const value = Math.abs(raw) < 0.005 ? 0 : raw; // no "-0,00 €" from rounding
    const good = costs ? value <= 0 : value >= 0;
    const neutral = Math.abs(value) < 0.5;
    return (
        <span className={classNames("tabular-nums font-medium",
            neutral ? "text-zinc-500 dark:text-zinc-400" : good ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {value > 0 ? "+" : ""}{format(value)}
        </span>
    );
}

export default function ClosingPage() {
    const data = useAppData();
    const {t} = useTranslation();
    // the closing page has its own month selection (?month=YYYY-MM) and leaves the global month alone;
    // without parameter it opens the last month if that is still open, otherwise the current month
    const [searchParams, setSearchParams] = useSearchParams();
    const lastMonth = dayjs().startOf("month").subtract(1, "month");
    const param = searchParams.get("month");
    const month = param && /^\d{4}-\d{2}$/.test(param) ? dayjs(`${param}-01`)
        : data.closings.some((c) => c.month === lastMonth.format("YYYY-MM")) ? dayjs().startOf("month") : lastMonth;
    const monthKey = month.format("YYYY-MM");
    const setMonth = (m: typeof month) => setSearchParams({month: m.format("YYYY-MM")}, {replace: true});
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const compare = (m: typeof month) => compareMonth(m, data.closings, data.contracts, data.persons, data.accounts, data.categories, mainCurrency);
    const current = useMemo(() => compare(month), // eslint-disable-next-line react-hooks/exhaustive-deps
        [data, monthKey, mainCurrency]);
    const potLabel = (pot: "household" | number) => pot === "household"
        ? t('overview.potHousehold') : data.persons.find((p) => p.id === pot)?.name ?? t('common.unknown');

    // the last 12 months up to the current one
    const months = useMemo(() => Array.from({length: 12}, (_, i) => dayjs().startOf("month").subtract(i, "month")).map((m) => {
        const c = compare(m);
        const comparable = c.pots.filter((p) => p.deviation != null);
        return {
            month: m,
            closed: !!c.closing,
            deviation: comparable.length ? comparable.reduce((s, p) => s + (p.deviation ?? 0), 0) : undefined,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [data, mainCurrency]);

    const comparable = current.pots.some((p) => p.deviation != null);
    const totalDeviation = current.pots.reduce((s, p) => s + (p.deviation ?? 0), 0);

    return (
        <div className="flex flex-col gap-6">
            <ClosingDialog open={editing} onClose={() => setEditing(false)} month={month} data={data}/>
            <ConfirmDialog
                isOpen={confirmDelete}
                title={t('closing.deleteTitle')}
                message={t('closing.deleteMessage', {month: month.format("MMMM YYYY")})}
                submitLabel={t('common.delete')}
                onClose={() => setConfirmDelete(false)}
                onSubmit={async () => {
                    await sendJson("DELETE", `/month_closings/${monthKey}`);
                    setConfirmDelete(false);
                    revalidator.revalidate();
                }}
            />
            <PageHeader title={t('closing.title')} subtitle={t('closing.subtitle')}
                        actions={<Button onClick={() => setEditing(true)} className="hover:cursor-pointer">
                            <ClipboardDocumentCheckIcon/>
                            {current.closing ? t('closing.edit', {month: month.format("MMMM")}) : t('closing.close', {month: month.format("MMMM")})}
                        </Button>}/>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className="xl:col-span-2 flex flex-col gap-6 min-w-0">
                    {!current.closing ? (
                        <div className={card + " text-center py-10"}>
                            <IconTile iconComponent={ClipboardDocumentCheckIcon} color={1} className="size-12 mx-auto"/>
                            <div className="mt-3 font-medium text-zinc-950 dark:text-white">{t('closing.openTitle', {month: month.format("MMMM YYYY")})}</div>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">{t('closing.openText')}</p>
                            <Button className="mt-4 hover:cursor-pointer" onClick={() => setEditing(true)}>
                                {t('closing.close', {month: month.format("MMMM")})}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className={card}>
                                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
                                    <div className={cardTitle}>{t('closing.potsTitle')}</div>
                                    {comparable && (
                                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                            {t('closing.totalDeviation')} <Deviation value={totalDeviation} format={format}/>
                                        </div>
                                    )}
                                </div>
                                {!comparable && <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">{t('closing.notComparable')}</p>}
                                <div className="overflow-x-auto -mx-5">
                                    <table className={table}>
                                        <thead>
                                        <tr>
                                            <th className={th + " pl-5"}>{t('overview.pot')}</th>
                                            <th className={th + " text-right hidden sm:table-cell"}>{t('closing.planned')}</th>
                                            <th className={th + " text-right"}>{t('closing.actualChange')}</th>
                                            <th className={th + " text-right pr-5"}>{t('closing.deviation')}</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {current.pots.map((p) => (
                                            <tr key={String(p.pot)} className={tr}>
                                                <td className={td + " pl-5 font-medium text-zinc-950 dark:text-white"}>{potLabel(p.pot)}</td>
                                                <td className={td + " text-right tabular-nums hidden sm:table-cell"}>{format(p.planned)}</td>
                                                <td className={td + " text-right tabular-nums"}>{p.actual != null ? format(p.actual) : "–"}</td>
                                                <td className={td + " text-right pr-5"}>
                                                    {p.deviation != null ? <Deviation value={p.deviation} format={format}/> : "–"}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">{t('closing.potsHint')}</p>
                            </div>

                            <div className={card}>
                                <div className={cardTitle + " mb-3"}>{t('closing.categoriesTitle')}</div>
                                {current.categories.length === 0 ? (
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('closing.noActuals')}</p>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {current.categories.map(({category, planned, actual, deviation}) => {
                                            const max = Math.max(planned, actual, 1);
                                            return (
                                                <div key={category.id}>
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <IconTile icon={category.icon} color={category.color} className="size-7"/>
                                                        <div className="grow min-w-0 sm:flex sm:items-center sm:gap-3">
                                                            <div className="truncate text-zinc-950 dark:text-white sm:grow">{categoryLabel(category.name, category.key)}</div>
                                                            <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                                {t('closing.planVsActual', {plan: format(planned), actual: format(actual)})}
                                                            </div>
                                                        </div>
                                                        <span className="shrink-0 text-right sm:w-24"><Deviation value={deviation} format={format} costs/></span>
                                                    </div>
                                                    {/* actual as bar, plan as marker */}
                                                    <div className="relative mt-2 ml-10 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                                                        <div className="h-full rounded-full" style={{width: `${actual / max * 100}%`, background: slotColor(category.color)}}/>
                                                        <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-zinc-950 dark:bg-white"
                                                             style={{left: `calc(${planned / max * 100}% - 1px)`}} title={t('closing.planned')}/>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {current.closing.notes && (
                                <div className={card}>
                                    <div className={cardTitle + " mb-1"}>{t('entryForm.notes')}</div>
                                    <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{current.closing.notes}</p>
                                </div>
                            )}
                            <div>
                                <button onClick={() => setConfirmDelete(true)}
                                        className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline hover:cursor-pointer">
                                    {t('closing.deleteTitle')}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className={card}>
                    <div className={cardTitle + " mb-3"}>{t('closing.monthsTitle')}</div>
                    <ul className="flex flex-col gap-1">
                        {months.map((m) => (
                            <li key={m.month.format("YYYY-MM")}>
                                <button onClick={() => setMonth(m.month)}
                                        className={classNames("w-full flex items-center gap-3 rounded-lg -mx-2 px-2 py-2 text-left hover:cursor-pointer",
                                            m.month.isSame(month, "month") ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50")}>
                                    {m.closed
                                        ? <CheckCircleIcon className="size-5 text-green-600 dark:text-green-400" aria-label={t('closing.closed')}/>
                                        : <span className="size-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600" aria-label={t('closing.open')}/>}
                                    <span className="grow text-sm text-zinc-950 dark:text-white">{m.month.format("MMMM YYYY")}</span>
                                    {m.deviation != null
                                        ? <span className="text-sm"><Deviation value={m.deviation} format={format}/></span>
                                        : <span className="text-xs text-zinc-400 dark:text-zinc-500">{m.closed ? t('closing.closed') : t('closing.open')}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
