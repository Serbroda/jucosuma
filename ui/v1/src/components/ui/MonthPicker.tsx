import {useTranslation} from "react-i18next";
import {ArrowUturnLeftIcon, ChevronLeftIcon, ChevronRightIcon} from "@heroicons/react/20/solid";
import clsx from "clsx";
import {useMonth} from "../../stores/useMonth.ts";
import SegmentedControl from "../SegmentedControl.tsx";
import dayjs from "../../lib/dayjs";

/**
 * Global month selector shared by all pages. When another month than the current one is
 * selected, it is highlighted and offers a prominent way back to the current month.
 */
export default function MonthPicker() {
    const {t} = useTranslation();
    const {month, setMonth, mode, setMode} = useMonth();
    const today = dayjs();
    const isCurrent = month.isSame(today, "month");
    const button = clsx("p-2 hover:cursor-pointer",
        isCurrent ? "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            : "text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100");

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            {/* how recurring amounts count: spread over the months, or only in the month they are due */}
            <SegmentedControl value={mode} onChange={setMode} options={[
                {value: "average", label: t('overview.modeAverageShort'), title: t('overview.modeAverageHint')},
                {value: "due", label: t('overview.modeDueShort'), title: t('overview.modeDueHint')},
            ]}/>
            {!isCurrent && (
                <button
                    onClick={() => setMonth(today)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 hover:cursor-pointer"
                >
                    <ArrowUturnLeftIcon className="size-4"/>
                    {t('overview.backToCurrent', {month: today.format("MMMM YYYY")})}
                </button>
            )}
            <div className={clsx("flex items-center rounded-lg ring-1",
                isCurrent ? "ring-zinc-200 dark:ring-zinc-700 bg-white dark:bg-zinc-900"
                    : "ring-2 ring-amber-400 bg-amber-50 dark:ring-amber-500/60 dark:bg-amber-500/10")}>
                <button aria-label={t('overview.previousMonth')} onClick={() => setMonth(month.subtract(1, "month"))} className={button}>
                    <ChevronLeftIcon className="size-4"/>
                </button>
                <button
                    className={clsx("text-sm font-medium w-36 text-center hover:cursor-pointer",
                        isCurrent ? "text-zinc-950 dark:text-white" : "text-amber-900 dark:text-amber-200")}
                    title={t('overview.currentMonth')} onClick={() => setMonth(today)}
                >
                    {month.format("MMMM YYYY")}
                </button>
                <button aria-label={t('overview.nextMonth')} onClick={() => setMonth(month.add(1, "month"))} className={button}>
                    <ChevronRightIcon className="size-4"/>
                </button>
            </div>
        </div>
    );
}
