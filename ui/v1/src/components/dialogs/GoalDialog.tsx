import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import {Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Select} from "../catalyst/select.tsx";
import SegmentedControl from "../SegmentedControl.tsx";
import NameIconField from "../ui/NameIconField.tsx";
import {goalStyle} from "../../utils/household.utils.ts";
import {GoalKindInvesting, GoalKindSaving, type AccountDto, type ContractDto, type PersonDto, type SavingsGoalDto} from "../../gen/types.gen.ts";
import {Button} from "../catalyst/button.tsx";
import {PlusIcon} from "@heroicons/react/16/solid";
import {usePreferences} from "../../stores/usePreferences.ts";
import {entryIntervalLabel} from "../../utils/data.utils.ts";
import {formatDecimal, numberLocale, parseAmount} from "../../utils/number.utils.ts";
import {sendJson} from "../../lib/api.ts";
import dayjs from "../../lib/dayjs";

export default function GoalDialog({open, onClose, goal, persons, accounts, count, payments = [], monthlyRate = 0, onAddPayment}: {
    open: boolean;
    onClose: () => void;
    goal?: SavingsGoalDto;
    persons: PersonDto[];
    accounts: AccountDto[];
    count: number;
    /** transfers linked to the goal; their recurring amounts are its monthly rate */
    payments?: ContractDto[];
    monthlyRate?: number;
    onAddPayment?: () => void;
}) {
    const {mainCurrency} = usePreferences();
    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
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
        setIcon(goal?.icon ?? undefined);
        setColor(goal?.color ?? undefined);
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

    const kindDefault = goalStyle({kind});

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={goal ? t('goals.edit') : t('goals.add')}>
            <NameIconField name={name} onNameChange={setName} placeholder={t('goals.namePlaceholder')}
                           icon={icon} color={color} defaultIcon={kindDefault.icon} defaultColor={kindDefault.color}
                           onIconChange={(i, c) => {
                               setIcon(i);
                               setColor(c);
                           }}/>
            <Field>
                <Label>{t('goals.kind')}</Label>
                <div className="mt-2">
                    <SegmentedControl value={kind} onChange={setKind} options={[
                        {value: GoalKindSaving, label: t('goals.saving')},
                        {value: GoalKindInvesting, label: t('goals.investing')},
                    ]}/>
                </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('goals.target')}</Label>
                    <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0,00" className="[&_input]:text-right"/>
                </Field>
                <Field>
                    <Label>{t('savings.goalDate')}</Label>
                    <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}/>
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('goals.current')}</Label>
                    <Input inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="0,00" className="[&_input]:text-right"/>
                </Field>
                <Field>
                    <Label>{t('household.owner')}</Label>
                    <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                        <option value="">{t('common.shared')}</option>
                        {persons.filter((p) => p.in_household).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                </Field>
            </div>
            {/* the monthly rate comes from linked transfers, not from a field of the goal */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-950 dark:text-white">{t('goals.payments')}</span>
                    {goal && onAddPayment && (
                        <Button outline type="button" onClick={onAddPayment} className="hover:cursor-pointer">
                            <PlusIcon/>{t('goals.addPayment')}
                        </Button>
                    )}
                </div>
                {payments.length > 0 ? (
                    <>
                        <ul className="mt-2 divide-y divide-zinc-950/5 dark:divide-white/5">
                            {payments.map((c) => (
                                <li key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                                    <span className="truncate text-zinc-700 dark:text-zinc-300">{c.name}</span>
                                    <span className="shrink-0 tabular-nums text-zinc-950 dark:text-white">
                                        {format(c.costs ?? 0)} <span className="text-zinc-400 dark:text-zinc-500">{entryIntervalLabel(c)}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('goals.rateFromPayments', {amount: format(monthlyRate)})}</div>
                    </>
                ) : (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{goal ? t('goals.noPayments') : t('goals.noPaymentsNew')}</p>
                )}
            </div>
            <Field>
                <Label>{t('goals.account')}</Label>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    <option value="">{t('common.noAccount')}</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
            </Field>
        </FormDialog>
    );
}
