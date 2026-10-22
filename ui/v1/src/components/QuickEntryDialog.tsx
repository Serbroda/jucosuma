import {useEffect, useRef, useState} from "react";
import {useNavigate, useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "./catalyst/dialog.tsx";
import {Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Button} from "./catalyst/button.tsx";
import {Checkbox, CheckboxField} from "./catalyst/checkbox.tsx";
import {useAuth} from "../stores/useAuth.ts";
import SharesEditor from "./SharesEditor.tsx";
import {
    BillingPeriodMonthly,
    BillingPeriodOneTime,
    EntryKindExpense,
    EntryKindIncome,
    EntryKindTransfer,
    type AccountDto,
    type CategoryDto,
    type SavingsGoalDto,
    type ContractDto,
    type PersonDto,
    type ShareDto,
} from "../gen/types.gen.ts";
import {billingPeriodLabel} from "../utils/data.utils.ts";
import {categoryLabel, isContractCategory, defaultShares, entryKinds, entryPeriods, recallAccount, rememberAccount} from "../utils/household.utils.ts";
import {parseAmount} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import dayjs from "../lib/dayjs";


export interface QuickEntryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    persons: PersonDto[];
    accounts: AccountDto[];
    categories: CategoryDto[];
    goals?: SavingsGoalDto[];
    /** Entry kind preselected when the dialog opens (default: expense). */
    initialKind?: string;
}

export default function QuickEntryDialog({isOpen, onClose, persons, accounts, categories, goals = [], initialKind}: QuickEntryDialogProps) {
    const navigate = useNavigate();
    const {t} = useTranslation();
    const revalidator = useRevalidator();
    const nameRef = useRef<HTMLInputElement>(null);

    const [kind, setKind] = useState<string>(EntryKindExpense);
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [period, setPeriod] = useState<string>(BillingPeriodMonthly);
    const [startDate, setStartDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [categoryId, setCategoryId] = useState<number | undefined>();
    const [isContract, setIsContract] = useState(false);
    const [contractTouched, setContractTouched] = useState(false);
    const [goalId, setGoalId] = useState<number | undefined>();
    const [accountId, setAccountId] = useState<number | undefined>();
    const [targetAccountId, setTargetAccountId] = useState<number | undefined>();
    const [shares, setShares] = useState<ShareDto[]>([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [savedName, setSavedName] = useState("");
    const [onlyMe, setOnlyMe] = useState(false);
    const {user} = useAuth();

    const isExpense = kind === EntryKindExpense;
    const isTransfer = kind === EntryKindTransfer;

    const initialShares = (forKind: string) => forKind === EntryKindExpense ? defaultShares(persons) : [];

    /** Categories matching the entry kind; transfers have none. */
    const categoriesFor = (forKind: string) => categories.filter((c) => c.type === forKind);
    const defaultCategory = (forKind: string) => {
        const options = categoriesFor(forKind);
        const preferred = forKind === EntryKindIncome ? "salary" : "other";
        return (options.find((c) => c.key === preferred) ?? options[0])?.id;
    };

    /** Picks a category and, unless set by hand, the matching "is contract" default. */
    const chooseCategory = (id: number | undefined, touched = contractTouched) => {
        setCategoryId(id);
        if (!touched) setIsContract(isContractCategory(categories.find((c) => c.id === id)));
    };

    const reset = (keepKind = kind) => {
        setName("");
        setContractTouched(false);
        chooseCategory(defaultCategory(keepKind), false);
        setGoalId(undefined);
        setAmount("");
        setError("");
        setAccountId(recallAccount(keepKind, "from", accounts));
        setTargetAccountId(recallAccount(keepKind, "to", accounts));
        setShares(initialShares(keepKind));
    };

    useEffect(() => {
        if (isOpen) {
            const startKind = initialKind ?? EntryKindExpense;
            setKind(startKind);
            reset(startKind);
            setSavedName("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const changeKind = (value: string) => {
        setKind(value);
        setAccountId(recallAccount(value, "from", accounts));
        setTargetAccountId(recallAccount(value, "to", accounts));
        setShares(initialShares(value));
        chooseCategory(defaultCategory(value));
        setGoalId(undefined);
    };

    const save = async (): Promise<ContractDto | null> => {
        const costs = parseAmount(amount);
        if (!name.trim()) {
            setError(t('entry.errorName'));
            nameRef.current?.focus();
            return null;
        }
        if (costs == null) {
            setError(t('entry.errorAmount'));
            return null;
        }
        if (isTransfer && (accountId == null || targetAccountId == null || accountId === targetAccountId)) {
            setError(t('entry.errorTransfer'));
            return null;
        }

        const meta: Partial<ContractDto> = {
            name: name.trim(),
            kind,
            costs,
            billing_period: period,
            start_date: startDate,
            // transfers get the server's default category
            category_id: isTransfer ? undefined : categoryId,
            is_contract: isExpense && isContract,
            goal_id: isTransfer ? goalId : undefined,
            currency: "EUR",
            account_id: accountId,
            target_account_id: isTransfer ? targetAccountId : undefined,
            shares: isExpense ? shares : [],
            split_between: 1,
            owner_id: onlyMe ? user?.id : undefined,
        };
        const fd = new FormData();
        fd.append("meta", JSON.stringify(meta));

        setSaving(true);
        setError("");
        try {
            const res = await apiFetch(`${apiBasePath}/contracts`, {method: "POST", body: fd});
            if (!res.ok) {
                const text = await res.text();
                let message = text || t('entry.saveFailed');
                try {
                    message = JSON.parse(text).message || message;
                } catch {
                    // plain text error
                }
                setError(message);
                return null;
            }
            rememberAccount(kind, "from", accountId);
            if (isTransfer) rememberAccount(kind, "to", targetAccountId);
            revalidator.revalidate();
            return await res.json();
        } finally {
            setSaving(false);
        }
    };

    const saveAndClose = async () => {
        if (await save()) onClose();
    };

    const saveAndNew = async () => {
        const saved = await save();
        if (saved) {
            setSavedName(saved.name);
            reset();
            nameRef.current?.focus();
        }
    };

    const saveAndEdit = async () => {
        const saved = await save();
        if (saved) {
            onClose();
            navigate(`/contracts/${saved.id}/edit`);
        }
    };

    const accountOptions = (
        <>
            <option value="">{t('common.noAccount')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </>
    );

    return (
        <Dialog open={isOpen} onClose={onClose} size="lg">
            <DialogTitle>{t('entry.newEntry')}</DialogTitle>
            <DialogBody>
                <form
                    className="grid grid-cols-1 gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        saveAndClose();
                    }}
                >
                    <div className="grid grid-cols-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 text-sm">
                        {entryKinds().map((k) => (
                            <button
                                key={k.value}
                                type="button"
                                onClick={() => changeKind(k.value)}
                                className={classNames(
                                    "rounded-md py-1.5 transition-colors hover:cursor-pointer",
                                    kind === k.value
                                        ? "bg-white dark:bg-zinc-950 shadow-sm font-medium text-zinc-950 dark:text-white"
                                        : "text-zinc-500 dark:text-zinc-400",
                                )}
                            >
                                {k.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-[1fr_7rem] gap-2">
                        <Field>
                            <Label>{t('common.name')}</Label>
                            <Input
                                ref={nameRef}
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={isExpense ? t('entry.placeholderExpense') : isTransfer ? t('entry.placeholderTransfer') : t('entry.placeholderIncome')}
                            />
                        </Field>
                        <Field>
                            <Label>{t('entry.amountEur')}</Label>
                            <Input
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0,00"
                                className="text-right"
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Field>
                            <Label>{t('entry.interval')}</Label>
                            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                                {entryPeriods.map((p) => <option key={p} value={p}>{billingPeriodLabel(p)}</option>)}
                            </Select>
                        </Field>
                        <Field>
                            <Label>{period === BillingPeriodOneTime ? t('entry.date') : t('entry.starting')}</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}/>
                        </Field>
                    </div>

                    <div className="grid gap-2 grid-cols-2">
                        <Field>
                            <Label>{isExpense ? t('entry.paidFrom') : isTransfer ? t('entry.fromAccount') : t('entry.toAccount')}</Label>
                            <Select value={accountId ?? ""}
                                    onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}>
                                {accountOptions}
                            </Select>
                        </Field>
                        {isTransfer && (
                            <Field>
                                <Label>{t('entry.toAccount')}</Label>
                                <Select value={targetAccountId ?? ""}
                                        onChange={(e) => setTargetAccountId(e.target.value ? Number(e.target.value) : undefined)}>
                                    {accountOptions}
                                </Select>
                            </Field>
                        )}
                        {!isTransfer && (
                            <Field>
                                <Label>{t('entry.category')}</Label>
                                <Select value={categoryId ?? ""} onChange={(e) => chooseCategory(e.target.value ? Number(e.target.value) : undefined)}>
                                    {categoriesFor(kind).map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.name, c.key)}</option>)}
                                </Select>
                            </Field>
                        )}
                    </div>

                    {isTransfer && goals.length > 0 && (
                        <Field>
                            <Label>{t('goals.goal')}</Label>
                            <Select value={goalId ?? ""} onChange={(e) => setGoalId(e.target.value ? Number(e.target.value) : undefined)}>
                                <option value="">{t('goals.noGoal')}</option>
                                {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </Select>
                        </Field>
                    )}

                    {isExpense && (
                        <Field>
                            <Label>{t('entry.whoCarries')}</Label>
                            <div className="mt-2">
                                <SharesEditor persons={persons} value={shares} onChange={setShares}/>
                            </div>
                        </Field>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {isExpense && (
                            <CheckboxField>
                                <Checkbox checked={isContract} onChange={(v) => {
                                    setIsContract(v);
                                    setContractTouched(true);
                                }}/>
                                <Label>{t('contracts.isContract')}</Label>
                            </CheckboxField>
                        )}
                        <CheckboxField>
                            <Checkbox checked={onlyMe} onChange={setOnlyMe}/>
                            <Label>{t('entry.onlyMe')}</Label>
                        </CheckboxField>
                    </div>

                    {accounts.length === 0 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('entry.tipAccounts')}
                        </p>
                    )}

                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    {savedName && !error && (
                        <p className="text-sm text-green-700 dark:text-green-400">{t('entry.saved', {name: savedName})}</p>
                    )}

                    {/* hidden submit so Enter saves */}
                    <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1}/>
                </form>
            </DialogBody>
            <DialogActions className="flex-wrap">
                <Button plain onClick={saveAndEdit} disabled={saving} className="hover:cursor-pointer sm:mr-auto">
                    {t('entry.moreDetails')}
                </Button>
                <Button outline onClick={saveAndNew} disabled={saving} className="hover:cursor-pointer">
                    {t('entry.saveAndNew')}
                </Button>
                <Button onClick={saveAndClose} disabled={saving} className="hover:cursor-pointer">
                    {saving ? t('common.saving') : t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
