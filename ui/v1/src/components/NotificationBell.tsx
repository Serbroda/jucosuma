import {useCallback, useEffect, useState} from "react";
import {useNavigate} from "react-router";
import {useTranslation} from "react-i18next";
import * as Headless from "@headlessui/react";
import {BellIcon, Cog6ToothIcon} from "@heroicons/react/20/solid";
import type {NotificationDto, NotificationListDto} from "../gen/types.gen.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";
import {apiBasePath} from "../config.ts";
import {classNames} from "../utils/dom.utils.ts";

const POLL_MS = 60_000;

/** "vor 5 Minuten", "vor 2 Tagen" … */
function relativeTime(date: string, lang: string): string {
    const seconds = (new Date(date).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(lang, {numeric: "auto"});
    const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return rtf.format(0, "minute");
}

/** Personal reminders (bell) with unread count; reminders can be marked as read. */
export default function NotificationBell() {
    const {t, i18n} = useTranslation();
    const navigate = useNavigate();
    const [data, setData] = useState<NotificationListDto>({items: [], unread: 0});

    const load = useCallback(async () => {
        const res = await apiFetch(`${apiBasePath}/notifications`).catch(() => null);
        if (res?.ok) setData(await res.json());
    }, []);

    useEffect(() => {
        load();
        const timer = window.setInterval(load, POLL_MS);
        window.addEventListener("focus", load);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", load);
        };
    }, [load]);

    const markRead = async (n: NotificationDto) => {
        if (!n.read) {
            await sendJson("POST", `/notifications/${n.id}/read`);
            await load();
        }
    };
    const markAll = async () => {
        await sendJson("POST", "/notifications/read-all");
        await load();
    };

    return (
        <Headless.Popover className="relative">
            <Headless.PopoverButton aria-label={t('notifications.title')}
                                    className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white hover:cursor-pointer focus:outline-none">
                <BellIcon className="size-5"/>
                {data.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4.5 text-white text-center">
                        {data.unread > 99 ? "99+" : data.unread}
                    </span>
                )}
            </Headless.PopoverButton>
            <Headless.PopoverPanel anchor={{to: "bottom end", gap: 8}} transition
                                   className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-white dark:bg-zinc-900 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 transition duration-100 data-closed:opacity-0">
                {({close}) => (
                    <>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-950/5 dark:border-white/5">
                            <span className="text-sm font-semibold text-zinc-950 dark:text-white">{t('notifications.title')}</span>
                            {data.unread > 0 && (
                                <button onClick={markAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline hover:cursor-pointer">
                                    {t('notifications.markAll')}
                                </button>
                            )}
                        </div>
                        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-950/5 dark:divide-white/5">
                            {data.items.length === 0 && (
                                <li className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">{t('notifications.empty')}</li>
                            )}
                            {data.items.map((n) => (
                                <li key={n.id}>
                                    <button
                                        onClick={async () => {
                                            await markRead(n);
                                            if (n.link) {
                                                close();
                                                navigate(n.link);
                                            }
                                        }}
                                        className={classNames("flex w-full gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:cursor-pointer",
                                            n.read ? "opacity-60" : "")}>
                                        <span className={classNames("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-blue-600")}/>
                                        <span className="min-w-0 grow">
                                            <span className="block text-sm font-medium text-zinc-950 dark:text-white">{n.title}</span>
                                            {n.body && <span className="block text-sm text-zinc-600 dark:text-zinc-400">{n.body}</span>}
                                            <span className="block text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{relativeTime(n.created_at, i18n.language)}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-zinc-950/5 dark:border-white/5 px-4 py-2.5">
                            <button onClick={() => {
                                close();
                                navigate("/settings/notifications");
                            }} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:cursor-pointer">
                                <Cog6ToothIcon className="size-4"/>{t('notifications.settings')}
                            </button>
                        </div>
                    </>
                )}
            </Headless.PopoverPanel>
        </Headless.Popover>
    );
}
