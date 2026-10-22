import {NavLink, Outlet} from "react-router";
import {useTranslation} from "react-i18next";
import {classNames} from "../utils/dom.utils.ts";

/** Settings area: general settings plus the rarely used management pages as tabs. */
export default function SettingsLayout() {
    const {t} = useTranslation();
    const tabs = [
        {to: "/settings", label: t('settings.tabGeneral'), end: true},
        {to: "/settings/categories", label: t('nav.categories')},
        {to: "/settings/persons", label: t('settings.tabPersons')},
    ];
    return (
        <div className="flex flex-col gap-6">
            <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 -mt-2">
                {tabs.map((tab) => (
                    <NavLink key={tab.to} to={tab.to} end={tab.end}
                             className={({isActive}) => classNames(
                                 "shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 -mb-px",
                                 isActive
                                     ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                                     : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")}>
                        {tab.label}
                    </NavLink>
                ))}
            </nav>
            <Outlet/>
        </div>
    );
}
