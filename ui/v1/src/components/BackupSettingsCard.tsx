import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowPathIcon, CircleStackIcon} from "@heroicons/react/16/solid";
import {Description, Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Switch, SwitchField} from "./catalyst/switch.tsx";
import {Button} from "./catalyst/button.tsx";
import type {BackupSettingsDto} from "../gen/types.gen.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";
import {apiBasePath} from "../config.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {card, cardTitle} from "../utils/ui.ts";
import dayjs from "../lib/dayjs";

/** Admin settings of the daily database backups. There is deliberately no download: a backup
 * contains everybody's private entries. */
export default function BackupSettingsCard() {
    const {t} = useTranslation();
    const [settings, setSettings] = useState<BackupSettingsDto | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [keep, setKeep] = useState("14");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const apply = (s: BackupSettingsDto) => {
        setSettings(s);
        setEnabled(s.enabled);
        setKeep(String(s.keep));
    };

    useEffect(() => {
        apiFetch(`${apiBasePath}/backups`).then(async (res) => res.ok && apply(await res.json()));
    }, []);

    const save = async () => {
        const days = Number(keep);
        if (!Number.isInteger(days) || days < 1 || days > 365) return setMessage({ok: false, text: t('backups.errorKeep')});
        setBusy(true);
        const err = await sendJson("PUT", "/backups", {enabled, keep: days});
        if (!err) {
            const res = await apiFetch(`${apiBasePath}/backups`);
            if (res.ok) apply(await res.json());
        }
        setBusy(false);
        setMessage(err ? {ok: false, text: err} : {ok: true, text: t('backups.saved')});
    };

    const runNow = async () => {
        setBusy(true);
        const res = await apiFetch(`${apiBasePath}/backups/run`, {method: "POST"});
        if (res.ok) apply(await res.json());
        setBusy(false);
        setMessage(res.ok ? {ok: true, text: t('backups.done')} : {ok: false, text: t('backups.failed')});
    };

    const size = (bytes: number) => new Intl.NumberFormat(numberLocale(), {maximumFractionDigits: 1}).format(bytes / 1024 / 1024) + " MB";
    if (!settings) return null;

    return (
        <div className={card}>
            <div className={cardTitle}>{t('backups.title')}</div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">{t('backups.hint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                <SwitchField>
                    <Label>{t('backups.enabled')}</Label>
                    <Description>{t('backups.enabledHint')}</Description>
                    <Switch checked={enabled} onChange={setEnabled}/>
                </SwitchField>
                <Field>
                    <Label>{t('backups.keep')}</Label>
                    <Description>{t('backups.keepHint')}</Description>
                    <div className="mt-2 flex items-center gap-2" data-slot="control">
                        <Input type="number" min={1} max={365} value={keep} onChange={(e) => setKeep(e.target.value)}
                               disabled={!enabled} className="w-24" aria-label={t('backups.keep')}/>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('backups.days')}</span>
                    </div>
                </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
                <Button onClick={save} disabled={busy} className="hover:cursor-pointer">{t('common.save')}</Button>
                <Button outline onClick={runNow} disabled={busy} className="hover:cursor-pointer">
                    <ArrowPathIcon/>{t('backups.runNow')}
                </Button>
                {message && (
                    <span className={message.ok ? "text-sm text-green-700 dark:text-green-400" : "text-sm text-red-600 dark:text-red-400"}>
                        {message.text}
                    </span>
                )}
            </div>

            <div className="mt-6">
                <div className="text-sm font-medium text-zinc-950 dark:text-white">{t('backups.existing', {count: settings.backups.length})}</div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 break-all">{t('backups.directory', {dir: settings.directory})}</div>
                {settings.backups.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{t('backups.none')}</p>
                ) : (
                    <ul className="mt-2 divide-y divide-zinc-950/5 dark:divide-white/5">
                        {settings.backups.map((b) => (
                            <li key={b.name} className="flex items-center gap-3 py-2 text-sm">
                                <CircleStackIcon className="size-4 shrink-0 fill-zinc-400 dark:fill-zinc-500"/>
                                <span className="grow truncate text-zinc-950 dark:text-white">{dayjs(b.created).format("DD.MM.YYYY, HH:mm")}</span>
                                <span className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:inline">{b.name}</span>
                                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{size(b.size)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
