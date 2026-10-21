import {useTranslation} from "react-i18next";
import {ClockIcon, ExclamationTriangleIcon} from "@heroicons/react/16/solid";
import clsx from "clsx";
import {daysUntil} from "../../utils/household.utils.ts";

/** Days until a deadline with urgency colour; colour is always paired with an icon and text. */
export default function DeadlineBadge({date}: { date: string }) {
    const {t} = useTranslation();
    const days = daysUntil(date);
    const urgent = days <= 30;
    const soon = days <= 60;
    const Icon = urgent ? ExclamationTriangleIcon : ClockIcon;
    return (
        <span className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
            urgent ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                : soon ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>
            <Icon className="size-3"/>
            {days <= 0 ? t('contracts.today') : t('contracts.inDays', {count: days})}
        </span>
    );
}
