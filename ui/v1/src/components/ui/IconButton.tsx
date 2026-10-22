import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import clsx from "clsx";

/** The clickable icon in front of a name field; opens the icon choice. */
export default function IconButton({onClick, active, children}: { onClick: () => void; active?: boolean; children: ReactNode }) {
    const {t} = useTranslation();
    return (
        <button type="button" onClick={onClick} title={t('icons.change')} aria-label={t('icons.change')} aria-expanded={active}
                className={clsx("rounded-lg hover:cursor-pointer hover:opacity-80 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500",
                    active && "ring-2 ring-zinc-900 dark:ring-white")}>
            {children}
        </button>
    );
}
