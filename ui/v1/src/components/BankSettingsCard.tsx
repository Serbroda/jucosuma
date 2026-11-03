import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Button} from "./catalyst/button.tsx";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";
import {apiBasePath} from "../config.ts";
import {card, cardTitle} from "../utils/ui.ts";

/** Admin setting how long the raw details of closed bank imports are kept. */
export default function BankSettingsCard() {
    const {t} = useTranslation();
    const [months, setMonths] = useState<string | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        apiFetch(`${apiBasePath}/bank_settings`).then(async (res) => res.ok && setMonths(String((await res.json()).raw_retention_months)));
    }, []);

    const save = async () => {
        const value = Number(months);
        const err = Number.isInteger(value) && value >= 0 && value <= 120
            ? await sendJson("PUT", "/bank_settings", {raw_retention_months: value})
            : "0–120";
        setMessage(err ? {ok: false, text: err} : {ok: true, text: t("bank.saved")});
    };

    if (months == null) return null;
    return (
        <div className={card}>
            <div className={cardTitle}>{t("bank.settingsTitle")}</div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">{t("bank.settingsHint")}</p>
            <Field>
                <Label>{t("bank.retentionLabel")}</Label>
            </Field>
            <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="w-24">
                    <Input type="number" min={0} max={120} value={months} aria-label={t("bank.retentionLabel")}
                           onChange={(e) => setMonths(e.target.value)}/>
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{t("bank.retentionMonths")}</span>
                <Button onClick={save} className="hover:cursor-pointer">{t("common.save")}</Button>
                {message && <span className={"text-sm " + (message.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{message.text}</span>}
            </div>
        </div>
    );
}
