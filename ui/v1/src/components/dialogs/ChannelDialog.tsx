import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import {Description, Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Select} from "../catalyst/select.tsx";
import type {NotificationChannelDto, NotificationSettingsDto} from "../../gen/types.gen.ts";
import {sendJson} from "../../lib/api.ts";
import {dynamicLabel} from "../../utils/notification.utils.ts";

/** Adds or edits an external channel. The fields depend on the kind (ntfy: topic/server/token, email: address). */
export default function ChannelDialog({open, onClose, onSaved, channel, settings}: {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    channel?: NotificationChannelDto;
    settings: NotificationSettingsDto;
}) {
    const {t} = useTranslation();
    const firstAvailable = settings.kinds.find((k) => k.available)?.kind ?? "ntfy";
    const [kind, setKind] = useState(firstAvailable);
    const [name, setName] = useState("");
    const [config, setConfig] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setKind(channel?.kind ?? firstAvailable);
        setName(channel?.name ?? "");
        setConfig({...(channel?.config ?? {})});
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, channel]);

    const set = (key: string, value: string) => setConfig({...config, [key]: value});
    const save = async () => {
        setSaving(true);
        const body = {kind, name, config, enabled: channel?.enabled ?? true};
        const err = channel
            ? await sendJson("PUT", `/notification-channels/${channel.id}`, body)
            : await sendJson("POST", "/notification-channels", body);
        setSaving(false);
        if (err) return setError(err);
        onSaved();
        onClose();
    };

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={channel ? t('notifications.editChannel') : t('notifications.addChannel')}>
            {!channel && (
                <Field>
                    <Label>{t('notifications.kind')}</Label>
                    <Select value={kind} onChange={(e) => {
                        setKind(e.target.value);
                        setConfig({});
                    }}>
                        {settings.kinds.map((k) => (
                            <option key={k.kind} value={k.kind} disabled={!k.available}>
                                {dynamicLabel(t, `notifications.kinds.${k.kind}`)}{k.available ? "" : ` – ${t('notifications.notSetUp')}`}
                            </option>
                        ))}
                    </Select>
                    {settings.kinds.some((k) => !k.available) && <Description>{t('notifications.notSetUpHint')}</Description>}
                </Field>
            )}
            <Field>
                <Label>{t('notifications.channelName')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={dynamicLabel(t, `notifications.kinds.${kind}`)}/>
            </Field>
            {kind === "ntfy" && <>
                <Field>
                    <Label>{t('notifications.ntfyTopic')}</Label>
                    <Description>{t('notifications.ntfyTopicHint')}</Description>
                    <Input value={config.topic ?? ""} onChange={(e) => set("topic", e.target.value)} placeholder="haushalt-danny-7f3k"/>
                </Field>
                <Field>
                    <Label>{t('notifications.ntfyServer')}</Label>
                    <Input value={config.server ?? ""} onChange={(e) => set("server", e.target.value)} placeholder={settings.default_ntfy_server}/>
                </Field>
                <Field>
                    <Label>{t('notifications.ntfyToken')}</Label>
                    <Description>{t('notifications.ntfyTokenHint')}</Description>
                    <Input type="password" autoComplete="off" value={config.token ?? ""} onChange={(e) => set("token", e.target.value)}/>
                </Field>
            </>}
            {kind === "email" && (
                <Field>
                    <Label>{t('notifications.emailAddress')}</Label>
                    <Input type="email" value={config.address ?? ""} onChange={(e) => set("address", e.target.value)}/>
                </Field>
            )}
        </FormDialog>
    );
}
