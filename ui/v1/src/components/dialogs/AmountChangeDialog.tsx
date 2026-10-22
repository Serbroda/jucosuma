import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import {Description, Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import type {ContractDto} from "../../gen/types.gen.ts";
import {formatDecimal, parseAmount} from "../../utils/number.utils.ts";
import {sendJson} from "../../lib/api.ts";
import dayjs from "../../lib/dayjs";

/** A row of the amount history being edited: the start amount (no id) or an amount change. */
export type AmountStep = { id?: number; validFrom: string; costs: number };

/**
 * Records a new amount from a date on (e.g. an insurance increase or a new grocery budget), or
 * edits an existing step. The start amount keeps the entry's start date.
 */
export default function AmountChangeDialog({open, onClose, contract, editing}: {
    open: boolean;
    onClose: () => void;
    contract: ContractDto;
    editing?: AmountStep;
}) {
    const isStart = editing != null && editing.id == null;
    const {t} = useTranslation();
    const revalidator = useRevalidator();
    const [validFrom, setValidFrom] = useState("");
    const [amount, setAmount] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setValidFrom(editing?.validFrom ?? dayjs().add(1, "month").startOf("month").format("YYYY-MM-DD"));
        const initial = editing?.costs ?? contract.costs;
        setAmount(initial != null ? formatDecimal(initial) || "0,00" : "");
        setError(null);
    }, [open, editing, contract.costs]);

    const save = async () => {
        const costs = parseAmount(amount);
        if (costs == null || !validFrom) return setError(t('amounts.errorInvalid'));
        setSaving(true);
        // the start amount is stored with the start date, which changes the base amount
        const err = editing?.id != null
            ? await sendJson("PUT", `/contracts/${contract.id}/amounts/${editing.id}`, {valid_from: validFrom, costs})
            : await sendJson("POST", `/contracts/${contract.id}/amounts`, {valid_from: validFrom, costs});
        setSaving(false);
        if (err) return setError(err);
        revalidator.revalidate();
        onClose();
    };

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={editing ? t('amounts.editTitle', {name: contract.name}) : t('amounts.dialogTitle', {name: contract.name})}>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('amounts.validFrom')}</Label>
                    <Input type="date" value={validFrom} disabled={isStart} onChange={(e) => setValidFrom(e.target.value)}/>
                </Field>
                <Field>
                    <Label>{editing ? t('entry.amount') : t('amounts.newAmount')}</Label>
                    <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="[&_input]:text-right"/>
                </Field>
            </div>
            <Description>{isStart ? t('amounts.startHint') : t('amounts.dialogHint')}</Description>
        </FormDialog>
    );
}
