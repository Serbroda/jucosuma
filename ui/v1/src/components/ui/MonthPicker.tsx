import {useTranslation} from "react-i18next";
import {ChevronLeftIcon, ChevronRightIcon} from "@heroicons/react/20/solid";
import {useMonth} from "../../stores/useMonth.ts";
import dayjs from "../../lib/dayjs";

/** Global month selector shared by all pages. */
export default function MonthPicker() {
    const {t} = useTranslation();
    const {month, setMonth} = useMonth();
    const button = "p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:cursor-pointer";
    return (
        <div className="flex items-center rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-700 bg-white dark:bg-zinc-900">
            <button aria-label={t('overview.previousMonth')} onClick={() => setMonth(month.subtract(1, "month"))} className={button}>
                <ChevronLeftIcon className="size-4"/>
            </button>
            <button className="text-sm font-medium w-36 text-center text-zinc-950 dark:text-white hover:cursor-pointer"
                    title={t('overview.currentMonth')} onClick={() => setMonth(dayjs())}>
                {month.format("MMMM YYYY")}
            </button>
            <button aria-label={t('overview.nextMonth')} onClick={() => setMonth(month.add(1, "month"))} className={button}>
                <ChevronRightIcon className="size-4"/>
            </button>
        </div>
    );
}
