import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {BellIcon, EnvelopeIcon, DevicePhoneMobileIcon, PlusIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import RowActions from "../components/ui/RowActions.tsx";
import ChannelDialog from "../components/dialogs/ChannelDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Checkbox} from "../components/catalyst/checkbox.tsx";
import {Switch} from "../components/catalyst/switch.tsx";
import type {NotificationChannelDto, NotificationSettingsDto} from "../gen/types.gen.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";
import {apiBasePath} from "../config.ts";
import {card, cardTitle, table, td, th, tr} from "../utils/ui.ts";
import type {IconComponent} from "../lib/icons.ts";
import {channelTarget, dynamicLabel} from "../utils/notification.utils.ts";

const kindIcon: Record<string, IconComponent> = {ntfy: DevicePhoneMobileIcon, email: EnvelopeIcon};

/** Personal reminder settings: own channels (ntfy, email, …) and which reminder goes where. */
export default function NotificationSettingsPage() {
    const {t} = useTranslation();
    const [settings, setSettings] = useState<NotificationSettingsDto | null>(null);
    const [editing, setEditing] = useState<NotificationChannelDto | null | undefined>(undefined);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        const res = await apiFetch(`${apiBasePath}/notification-settings`);
        if (res.ok) setSettings(await res.json());
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    if (!settings) return null;

    const enabled = (type: string, channel: string) =>
        settings.preferences.find((p) => p.type === type && p.channel === channel)?.enabled ?? true;
    const toggle = async (type: string, channel: string, value: boolean) => {
        setSettings({
            ...settings,
            preferences: [...settings.preferences.filter((p) => !(p.type === type && p.channel === channel)), {type, channel, enabled: value}],
        });
        await sendJson("PUT", "/notification-preferences", {type, channel, enabled: value});
    };
    const test = async (ch: NotificationChannelDto) => {
        setMessage(null);
        const err = await sendJson("POST", `/notification-channels/${ch.id}/test`);
        setMessage(err ? {ok: false, text: t('notifications.testFailed', {error: err})} : {ok: true, text: t('notifications.testSent')});
    };
    const setChannelEnabled = async (ch: NotificationChannelDto, value: boolean) => {
        await sendJson("PUT", `/notification-channels/${ch.id}`, {kind: ch.kind, name: ch.name, config: ch.config, enabled: value});
        await load();
    };
    const columns = [{key: "inapp", label: t('notifications.bell')},
        ...settings.channels.map((ch) => ({key: String(ch.id), label: ch.name || dynamicLabel(t, `notifications.kinds.${ch.kind}`)}))];

    return (
        <div className="flex flex-col gap-6">
            <ChannelDialog open={editing !== undefined} channel={editing ?? undefined} settings={settings}
                           onClose={() => setEditing(undefined)} onSaved={load}/>
            <PageHeader title={t('notifications.pageTitle')} subtitle={t('notifications.pageSubtitle')}
                        actions={<Button onClick={() => setEditing(null)} className="hover:cursor-pointer"><PlusIcon/>{t('notifications.addChannel')}</Button>}/>

            <div className={card}>
                <div className={cardTitle + " mb-3"}>{t('notifications.channels')}</div>
                <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
                    <li className="flex items-center gap-3 py-3">
                        <IconTile iconComponent={BellIcon} color={1} className="size-9"/>
                        <div className="grow min-w-0">
                            <div className="text-sm font-medium text-zinc-950 dark:text-white">{t('notifications.bell')}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('notifications.bellHint')}</div>
                        </div>
                    </li>
                    {settings.channels.map((ch) => (
                        <li key={ch.id} className="flex flex-wrap items-center gap-3 py-3">
                            <IconTile iconComponent={kindIcon[ch.kind] ?? BellIcon} color={ch.kind === "email" ? 3 : 7} className="size-9"/>
                            <div className="grow min-w-0">
                                <div className="text-sm font-medium text-zinc-950 dark:text-white">{ch.name || dynamicLabel(t, `notifications.kinds.${ch.kind}`)}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{channelTarget(ch, settings.default_ntfy_server)}</div>
                            </div>
                            <Button outline onClick={() => test(ch)} className="hover:cursor-pointer">{t('notifications.test')}</Button>
                            <Switch checked={ch.enabled} onChange={(v) => setChannelEnabled(ch, v)} aria-label={t('notifications.active')}/>
                            <RowActions onEdit={() => setEditing(ch)} onDelete={async () => {
                                await sendJson("DELETE", `/notification-channels/${ch.id}`);
                                await load();
                            }}/>
                        </li>
                    ))}
                </ul>
                {settings.channels.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{t('notifications.noChannels')}</p>}
                {message && (
                    <p className={message.ok ? "text-sm text-green-700 dark:text-green-400 mt-3" : "text-sm text-red-600 dark:text-red-400 mt-3"}>{message.text}</p>
                )}
            </div>

            <div className={card}>
                <div className={cardTitle}>{t('notifications.matrixTitle')}</div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-3">{t('notifications.matrixHint')}</p>
                <div className="overflow-x-auto -mx-5">
                    <table className={table}>
                        <thead>
                        <tr>
                            <th className={th + " pl-5"}>{t('notifications.reminder')}</th>
                            {columns.map((c) => <th key={c.key} className={th + " text-center whitespace-nowrap"}>{c.label}</th>)}
                        </tr>
                        </thead>
                        <tbody>
                        {settings.types.map((type) => (
                            <tr key={type} className={tr}>
                                <td className={td + " pl-5"}>
                                    <div className="font-medium text-zinc-950 dark:text-white">{dynamicLabel(t, `notifications.types.${type}`)}</div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{dynamicLabel(t, `notifications.types.${type}Hint`)}</div>
                                </td>
                                {columns.map((c) => (
                                    <td key={c.key} className={td + " text-center"}>
                                        <Checkbox checked={enabled(type, c.key)} onChange={(v) => toggle(type, c.key, v)}
                                                  aria-label={`${dynamicLabel(t, `notifications.types.${type}`)} – ${c.label}`}/>
                                    </td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
