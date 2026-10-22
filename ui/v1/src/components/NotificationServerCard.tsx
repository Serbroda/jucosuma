import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Description, Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Button} from "./catalyst/button.tsx";
import type {NotificationServerDto} from "../gen/types.gen.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";
import {apiBasePath} from "../config.ts";
import {card, cardTitle} from "../utils/ui.ts";

/** Admin: what reminders need from the installation – the app's address for links, the default
 * ntfy server and SMTP for emails. The SMTP password is write-only. */
export default function NotificationServerCard() {
    const {t} = useTranslation();
    const [s, setS] = useState<NotificationServerDto | null>(null);
    const [password, setPassword] = useState("");
    const [testTo, setTestTo] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        apiFetch(`${apiBasePath}/notification-server`).then(async (res) => res.ok && setS(await res.json()));
    }, []);
    if (!s) return null;
    const set = <K extends keyof NotificationServerDto>(key: K, value: NotificationServerDto[K]) => setS({...s, [key]: value});

    const run = async (action: () => Promise<string | null>, ok: string) => {
        setBusy(true);
        setMessage(null);
        const err = await action();
        setBusy(false);
        setMessage(err ? {ok: false, text: err} : {ok: true, text: ok});
    };
    const save = () => run(async () => {
        const err = await sendJson("PUT", "/notification-server", {...s, smtp_password: password});
        if (!err) {
            setPassword("");
            const res = await apiFetch(`${apiBasePath}/notification-server`);
            if (res.ok) setS(await res.json());
        }
        return err;
    }, t('backups.saved'));

    return (
        <div className={card}>
            <div className={cardTitle}>{t('notifications.serverTitle')}</div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">{t('notifications.serverHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                    <Label>{t('notifications.publicUrl')}</Label>
                    <Description>{t('notifications.publicUrlHint')}</Description>
                    <Input value={s.public_url} onChange={(e) => set("public_url", e.target.value)} placeholder="https://haushalt.example.com"/>
                </Field>
                <Field>
                    <Label>{t('notifications.ntfyServer')}</Label>
                    <Description>{t('notifications.defaultNtfyHint')}</Description>
                    <Input value={s.ntfy_server} onChange={(e) => set("ntfy_server", e.target.value)} placeholder="https://ntfy.sh"/>
                </Field>
            </div>

            <div className="text-sm font-semibold text-zinc-950 dark:text-white mt-6 mb-3">{t('notifications.smtp')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_10rem] gap-4">
                <Field>
                    <Label>{t('notifications.smtpHost')}</Label>
                    <Input value={s.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.example.com"/>
                </Field>
                <Field>
                    <Label>{t('notifications.smtpPort')}</Label>
                    <Input type="number" value={s.smtp_port || ""} onChange={(e) => set("smtp_port", Number(e.target.value))}/>
                </Field>
                <Field>
                    <Label>{t('notifications.smtpSecurity')}</Label>
                    <Select value={s.smtp_security} onChange={(e) => set("smtp_security", e.target.value)}>
                        <option value="starttls">STARTTLS</option>
                        <option value="tls">SSL/TLS</option>
                        <option value="none">{t('notifications.smtpNone')}</option>
                    </Select>
                </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <Field>
                    <Label>{t('notifications.smtpUser')}</Label>
                    <Input value={s.smtp_username} onChange={(e) => set("smtp_username", e.target.value)} autoComplete="off"/>
                </Field>
                <Field>
                    <Label>{t('notifications.smtpPassword')}</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                           placeholder={s.password_set ? t('notifications.passwordSet') : ""}/>
                </Field>
                <Field>
                    <Label>{t('notifications.smtpFrom')}</Label>
                    <Input value={s.smtp_from} onChange={(e) => set("smtp_from", e.target.value)} placeholder="Jucosuma <jucosuma@example.com>"/>
                </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-5">
                <Button onClick={save} disabled={busy} className="hover:cursor-pointer">{t('common.save')}</Button>
                <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={t('notifications.testRecipient')}
                       className="w-56" aria-label={t('notifications.testRecipient')}/>
                <Button outline disabled={busy || !testTo} className="hover:cursor-pointer"
                        onClick={() => run(() => sendJson("POST", "/notification-server/test-email", {to: testTo}), t('notifications.testSent'))}>
                    {t('notifications.testEmail')}
                </Button>
                <Button plain disabled={busy} className="hover:cursor-pointer"
                        onClick={() => run(() => sendJson("POST", "/notifications/check"), t('notifications.checked'))}>
                    {t('notifications.checkNow')}
                </Button>
            </div>
            {message && <p className={message.ok ? "text-sm text-green-700 dark:text-green-400 mt-3" : "text-sm text-red-600 dark:text-red-400 mt-3"}>{message.text}</p>}
        </div>
    );
}
