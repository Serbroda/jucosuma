import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import {Description, Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Select} from "../catalyst/select.tsx";
import {Checkbox, CheckboxField} from "../catalyst/checkbox.tsx";
import NameIconField from "../ui/NameIconField.tsx";
import {
    AccountTypeChecking,
    AccountTypeDepot,
    AccountTypeSavings,
    type AccountDto,
    type PersonDto,
} from "../../gen/types.gen.ts";
import {accountStyle, accountTypes} from "../../utils/household.utils.ts";
import {formatDecimal, parseAmount} from "../../utils/number.utils.ts";
import {sendJson} from "../../lib/api.ts";
import dayjs from "../../lib/dayjs";

export default function AccountDialog({open, onClose, account, persons}: {
    open: boolean;
    onClose: () => void;
    account?: AccountDto;
    persons: PersonDto[];
}) {
    const {t} = useTranslation();
    const revalidator = useRevalidator();
    const [name, setName] = useState("");
    const [type, setType] = useState<string>(AccountTypeChecking);
    const [personId, setPersonId] = useState("");
    const [iban, setIban] = useState("");
    const [balance, setBalance] = useState("");
    const [isSavings, setIsSavings] = useState(false);
    const [icon, setIcon] = useState<string | undefined>();
    const [color, setColor] = useState<number | undefined>();
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(account?.name ?? "");
        setType(account?.type ?? AccountTypeChecking);
        setPersonId(account?.person_id != null ? String(account.person_id) : "");
        setIban(account?.iban ?? "");
        setBalance(formatDecimal(account?.balance));
        setIsSavings(account?.is_savings ?? false);
        setIcon(account?.icon ?? undefined);
        setColor(account?.color ?? undefined);
        setError(null);
    }, [open, account]);

    const save = async () => {
        if (!name.trim()) return setError(t('entry.errorName'));
        const newBalance = parseAmount(balance);
        setSaving(true);
        const err = await sendJson(account ? "PUT" : "POST", account ? `/accounts/${account.id}` : "/accounts", {
            name: name.trim(),
            type,
            person_id: personId ? Number(personId) : null,
            sort_order: account?.sort_order ?? 0,
            is_savings: isSavings,
            iban: iban.replace(/\s+/g, "") || null,
            balance: newBalance ?? null,
            balance_date: newBalance !== account?.balance ? dayjs().format("YYYY-MM-DD") : account?.balance_date ?? null,
            goal_amount: account?.goal_amount ?? null,
            goal_date: account?.goal_date ?? null,
            icon: icon ?? null,
            color: color ?? null,
        });
        setSaving(false);
        if (err) return setError(err);
        revalidator.revalidate();
        onClose();
    };

    const typeDefault = accountStyle({type});

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={account ? t('accounts.edit') : t('accounts.add')}>
            <NameIconField name={name} onNameChange={setName} placeholder={t('household.accountPlaceholder')}
                           icon={icon} color={color} defaultIcon={typeDefault.icon} defaultColor={typeDefault.color}
                           onIconChange={(i, c) => {
                               setIcon(i);
                               setColor(c);
                           }}/>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('household.accountType')}</Label>
                    <Select value={type} onChange={(e) => {
                        setType(e.target.value);
                        if (e.target.value === AccountTypeSavings || e.target.value === AccountTypeDepot) setIsSavings(true);
                    }}>
                        {accountTypes().map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </Select>
                </Field>
                <Field>
                    <Label>{t('household.owner')}</Label>
                    <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                        <option value="">{t('common.shared')}</option>
                        {persons.filter((p) => p.in_household).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('accounts.iban')}</Label>
                    <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DE12 3456 …" autoComplete="off"/>
                </Field>
                <Field>
                    <Label>{t('accounts.currentBalance')}</Label>
                    <Input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)}
                           placeholder={t('savings.optional')} className="[&_input]:text-right"/>
                </Field>
            </div>
            <CheckboxField>
                <Checkbox checked={isSavings} onChange={setIsSavings}/>
                <Label>{t('accounts.isSavings')}</Label>
                <Description>{t('accounts.isSavingsHint')}</Description>
            </CheckboxField>
        </FormDialog>
    );
}
