import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Dialog, DialogActions, DialogBody, DialogDescription, DialogTitle} from "./catalyst/dialog.tsx";
import {Button} from "./catalyst/button.tsx";
import {Select} from "./catalyst/select.tsx";
import {Field, Label} from "./catalyst/fieldset.tsx";
import type {AccountDto, BankImportDto} from "../gen/types.gen.ts";
import {sendJson} from "../lib/api.ts";
import {accountName, sortedByName} from "../utils/household.utils.ts";

/** Moves an import with its bookings to another account, e.g. after picking the wrong one. */
export default function MoveImportDialog({imp, accounts, onClose}: {
    imp: BankImportDto | null;
    accounts: AccountDto[];
    onClose: (moved: boolean) => void;
}) {
    const {t} = useTranslation();
    const [accountId, setAccountId] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setAccountId("");
        setError("");
    }, [imp]);

    const move = async () => {
        if (!imp || !accountId) return;
        setSaving(true);
        const err = await sendJson("PUT", `/bank_imports/${imp.id}/account`, {account_id: Number(accountId)});
        setSaving(false);
        if (err) return setError(err);
        onClose(true);
    };

    return (
        <Dialog open={imp != null} onClose={() => onClose(false)}>
            <DialogTitle>{t("bank.moveImport")}</DialogTitle>
            <DialogDescription>
                {imp && t("bank.moveImportHint", {account: accountName(imp.account_id, accounts) ?? "?", count: imp.total})}
            </DialogDescription>
            <DialogBody className="flex flex-col gap-4">
                {error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
                )}
                <Field>
                    <Label>{t("bank.moveImportTo")}</Label>
                    <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                        <option value="">{t("bank.chooseAccount")}</option>
                        {sortedByName(accounts.filter((a) => a.id !== imp?.account_id), (a) => a.name)
                            .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                </Field>
            </DialogBody>
            <DialogActions>
                <Button plain onClick={() => onClose(false)} className="hover:cursor-pointer">{t("common.cancel")}</Button>
                <Button onClick={move} disabled={!accountId || saving} className="hover:cursor-pointer">{t("bank.moveImportSubmit")}</Button>
            </DialogActions>
        </Dialog>
    );
}
