import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import {Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Select} from "../catalyst/select.tsx";
import SegmentedControl from "../SegmentedControl.tsx";
import {ColorPicker, IconPicker} from "../ui/ColorIconPicker.tsx";
import {GoalKindInvesting, GoalKindSaving, type AccountDto, type PersonDto, type SavingsGoalDto} from "../../gen/types.gen.ts";
import {formatDecimal, parseAmount} from "../../utils/number.utils.ts";
import {sendJson} from "../../lib/api.ts";
import dayjs from "../../lib/dayjs";

export default function GoalDialog({open, onClose, goal, persons, accounts, count}: {
    open: boolean;
    onClose: () => void;
    goal?: SavingsGoalDto;
    persons: PersonDto[];
    accounts: AccountDto[];
    count: number;
}) {
    const {t} = useTranslation();
    const revalidator = useRevalidator();
    const [name, setName] = useState("");
    const [kind, setKind] = useState<string>(GoalKindSaving);
    const [icon, setIcon] = useState<string | undefined>();
    const [color, setColor] = useState<number | undefined>();
    const [personId, setPersonId] = useState("");
    const [accountId, setAccountId] = useState("");
    const [target, setTarget] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [current, setCurrent] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(goal?.name ?? "");
        setKind(goal?.kind ?? GoalKindSaving);
        setIcon(goal?.icon ?? "sparkles");
        setColor(goal?.color ?? 3);
        setPersonId(goal?.person_id != null ? String(goal.person_id) : "");
        setAccountId(goal?.account_id != null ? String(goal.account_id) : "");
        setTarget(formatDecimal(goal?.target_amount));
        setTargetDate(goal?.target_date ? dayjs(goal.target_date).format("YYYY-MM-DD") : "");
        setCurrent(formatDecimal(goal?.current_amount));
        setError(null);
    }, [open, goal]);

    const save = async () => {
        if (!name.trim()) return setError(t('entry.errorName'));
        const currentAmount = parseAmount(current);
        setSaving(true);
        const err = await sendJson(goal ? "PUT" : "POST", goal ? `/savings_goals/${goal.id}` : "/savings_goals", {
            name: name.trim(),
            kind,
            icon: icon ?? null,
            color: color ?? null,
            person_id: personId ? Number(personId) : null,
            account_id: accountId ? Number(accountId) : null,
            target_amount: parseAmount(target) ?? null,
            target_date: targetDate || null,
            current_amount: currentAmount ?? null,
            current_date: currentAmount !== goal?.current_amount || !goal?.current_date
                ? dayjs().format("YYYY-MM-DD") : dayjs(goal.current_date).format("YYYY-MM-DD"),
            sort_order: goal?.sort_order ?? count,
        });
        setSaving(false);
        if (err) return setError(err);
        revalidator.revalidate();
        onClose();
    };

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={goal ? t('goals.edit') : t('goals.add')}>
            <Field>
                <Label>{t('common.name')}</Label>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('goals.namePlaceholder')}/>
            </Field>
            <div className="flex flex-wrap gap-3">
                <SegmentedControl value={kind} onChange={setKind} options={[
                    {value: GoalKindSaving, label: t('goals.saving')},
                    {value: GoalKindInvesting, label: t('goals.investing')},
                ]}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('goals.target')}</Label>
                    <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0,00" className="text-right"/>
                </Field>
                <Field>
                    <Label>{t('savings.goalDate')}</Label>
                    <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}/>
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('goals.current')}</Label>
                    <Input inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0,00" className="text-right"/>
                </Field>
                <Field>
                    <Label>{t('household.owner')}</Label>
                    <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                        <option value="">{t('common.shared')}</option>
                        {persons.filter((p) => p.in_household).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                </Field>
            </div>
            <Field>
                <Label>{t('goals.account')}</Label>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    <option value="">{t('common.noAccount')}</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
            </Field>
            <Field>
                <Label>{t('categories.color')}</Label>
                <div className="mt-2"><ColorPicker value={color} onChange={setColor}/></div>
            </Field>
            <Field>
                <Label>{t('categories.icon')}</Label>
                <div className="mt-2"><IconPicker value={icon} color={color} onChange={setIcon}/></div>
            </Field>
        </FormDialog>
    );
}
