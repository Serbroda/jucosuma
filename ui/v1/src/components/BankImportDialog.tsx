import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle} from "./catalyst/dialog.tsx";
import {Button} from "./catalyst/button.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Field, Label} from "./catalyst/fieldset.tsx";
import type {AccountDto, BankImportResultDto} from "../gen/types.gen.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sortedByName} from "../utils/household.utils.ts";
import dayjs from "../lib/dayjs";

/** Uploads an exported bank statement: preview (account, period, new and known bookings), then import. */
export default function BankImportDialog({isOpen, onClose, accounts}: {
    isOpen: boolean;
    onClose: (imported: boolean) => void;
    accounts: AccountDto[];
}) {
    const {t} = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [accountId, setAccountId] = useState("");
    const [preview, setPreview] = useState<BankImportResultDto | null>(null);
    const [result, setResult] = useState<BankImportResultDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const close = () => {
        const imported = (result?.imported ?? 0) > 0;
        setFile(null);
        setAccountId("");
        setPreview(null);
        setResult(null);
        setError("");
        onClose(imported);
    };

    const send = async (asPreview: boolean, account = accountId) => {
        if (!file) return;
        setLoading(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            if (account) fd.append("account_id", account);
            if (asPreview) fd.append("preview", "true");
            const res = await apiFetch(`${apiBasePath}/bank_imports`, {method: "POST", body: fd});
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message || t("bank.importFailed"));
            if (asPreview) {
                setPreview(body);
                if (body.account_id) setAccountId(String(body.account_id));
            } else {
                setResult(body);
                setPreview(null);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const date = (d?: string) => (d ? dayjs(d).format("DD.MM.YYYY") : "?");
    const needsAccount = preview && !preview.account_id;

    return (
        <Dialog open={isOpen} onClose={close}>
            <DialogTitle>{t("bank.importTitle")}</DialogTitle>
            <DialogDescription>{t("bank.importPrivacy")}</DialogDescription>
            <DialogBody>
                {error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                        {error}
                    </div>
                )}
                {result ? (
                    <div className="text-sm flex flex-col gap-1">
                        <div className="text-green-600 dark:text-green-400 font-medium">{t("bank.imported", {count: result.imported})}</div>
                        {result.duplicates > 0 && <div className="text-zinc-500 dark:text-zinc-400">{t("bank.duplicates", {count: result.duplicates})}</div>}
                    </div>
                ) : preview ? (
                    <div className="flex flex-col gap-4 text-sm">
                        <div className="text-zinc-600 dark:text-zinc-300">
                            {t("bank.detected", {bank: preview.bank, from: date(preview.period_from), to: date(preview.period_to), count: preview.total})}
                        </div>
                        <Field>
                            <Label>{t("bank.account")}</Label>
                            <Select value={accountId} onChange={(e) => {
                                setAccountId(e.target.value);
                                if (e.target.value) send(true, e.target.value);
                            }}>
                                <option value="">{t("bank.chooseAccount")}</option>
                                {sortedByName(accounts, (a) => a.name).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </Select>
                        </Field>
                        {needsAccount ? (
                            <div className="text-amber-600 dark:text-amber-400">
                                {preview.iban ? t("bank.noAccountForIban", {iban: preview.iban}) : t("bank.noIban")}
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div className="font-medium text-zinc-950 dark:text-white">{t("bank.willImport", {count: preview.imported})}</div>
                                    {preview.duplicates > 0 && <div className="text-zinc-500 dark:text-zinc-400">{t("bank.duplicates", {count: preview.duplicates})}</div>}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {preview.scope === "HOUSEHOLD" ? t("bank.defaultHousehold") : t("bank.defaultPrivate")}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">{t("bank.upload")}</p>
                        <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)}/>
                    </div>
                )}
            </DialogBody>
            <DialogActions>
                {result ? (
                    <Button onClick={close} className="hover:cursor-pointer">{t("common.close")}</Button>
                ) : preview ? (
                    <>
                        <Button outline onClick={() => setPreview(null)} className="hover:cursor-pointer">{t("common.back")}</Button>
                        <Button onClick={() => send(false)} disabled={loading || !!needsAccount || preview.imported === 0} className="hover:cursor-pointer">
                            {loading ? t("bank.importing") : t("bank.import")}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button plain onClick={close} className="hover:cursor-pointer">{t("common.cancel")}</Button>
                        <Button onClick={() => send(true)} disabled={loading || !file} className="hover:cursor-pointer">
                            {loading ? t("common.loading") : t("bank.preview")}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
