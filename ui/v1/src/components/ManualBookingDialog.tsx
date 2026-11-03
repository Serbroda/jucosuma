import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "./catalyst/dialog.tsx";
import {Button} from "./catalyst/button.tsx";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {Field, Label} from "./catalyst/fieldset.tsx";
import SegmentedControl from "./SegmentedControl.tsx";
import BankTargetSelect from "./BankTargetSelect.tsx";
import {AccountTypeCash, type AccountDto, type BankTransactionDto, type CategoryDto, type ContractDto} from "../gen/types.gen.ts";
import {sendJson} from "../lib/api.ts";
import {selectedTargetValue, targetChange} from "../utils/bank.utils.ts";
import {sortedByName} from "../utils/household.utils.ts";
import {formatDecimal, parseAmount} from "../utils/number.utils.ts";
import dayjs from "../lib/dayjs";

type Direction = "out" | "in";
type Scope = "HOUSEHOLD" | "PRIVATE";

/** Enters or edits a booking by hand, e.g. cash spending. Without account it counts as cash. */
export default function ManualBookingDialog({open, booking, accounts, contracts, categories, onClose}: {
    open: boolean;
    /** the booking to edit; creates a new one without */
    booking?: BankTransactionDto | null;
    accounts: AccountDto[];
    contracts: ContractDto[];
    categories: CategoryDto[];
    /** called with the date of the last saved booking, or without when nothing was saved */
    onClose: (savedOn?: string) => void;
}) {
    const {t} = useTranslation();
    const [direction, setDirection] = useState<Direction>("out");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState("");
    const [counterparty, setCounterparty] = useState("");
    const [purpose, setPurpose] = useState("");
    const [accountId, setAccountId] = useState("");
    const [target, setTarget] = useState("");
    const [scope, setScope] = useState<Scope>("HOUSEHOLD");
    const [savedOn, setSavedOn] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const defaultAccount = () => accounts.find((a) => a.type === AccountTypeCash && a.person_id == null) ?? accounts.find((a) => a.type === AccountTypeCash);
    const scopeOf = (id: string) => accounts.find((a) => String(a.id) === id)?.person_id != null ? "PRIVATE" : "HOUSEHOLD";

    const reset = () => {
        const account = defaultAccount();
        setDirection("out");
        setAmount("");
        setDate(dayjs().format("YYYY-MM-DD"));
        setCounterparty("");
        setPurpose("");
        setAccountId(account ? String(account.id) : "");
        setTarget("");
        setScope(account ? scopeOf(String(account.id)) : "HOUSEHOLD");
        setError("");
    };

    useEffect(() => {
        if (!open) return;
        setSavedOn(undefined);
        if (!booking) return reset();
        setDirection(booking.amount < 0 ? "out" : "in");
        setAmount(formatDecimal(Math.abs(booking.amount)) || "");
        setDate(booking.booking_date);
        setCounterparty(booking.counterparty);
        setPurpose(booking.purpose);
        setAccountId(booking.account_id != null ? String(booking.account_id) : "");
        setTarget(selectedTargetValue(booking));
        setScope(booking.scope as Scope);
        setError("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, booking]);

    // a stand-in booking, so the target select offers what fits direction and date
    const draft = {amount: direction === "out" ? -1 : 1, booking_date: date || dayjs().format("YYYY-MM-DD"), ...selectedFields(target)} as BankTransactionDto;

    const save = async (another: boolean) => {
        const value = parseAmount(amount);
        if (!value || value <= 0) return setError(t("bank.manualErrorAmount"));
        if (!date) return setError(t("bank.manualErrorDate"));
        if (!counterparty.trim()) return setError(t("bank.manualErrorDescription"));
        const change = targetChange(target);
        setSaving(true);
        const body = {
            booking_date: date, amount: direction === "out" ? -value : value, counterparty: counterparty.trim(), purpose: purpose.trim(),
            account_id: accountId ? Number(accountId) : null, scope,
            category_id: change.category_id ?? null, contract_id: change.contract_id ?? null,
        };
        const err = booking
            ? await sendJson("PUT", `/bank_transactions/${booking.id}`, body)
            : await sendJson("POST", "/bank_transactions", body);
        setSaving(false);
        if (err) return setError(err);
        if (!another) return onClose(date);
        // keep date, account, target and scope for the next one, e.g. several cash receipts
        setSavedOn(date);
        setAmount("");
        setCounterparty("");
        setPurpose("");
        setError("");
    };

    return (
        <Dialog open={open} onClose={() => onClose(savedOn)}>
            <DialogTitle>{booking ? t("bank.manualEdit") : t("bank.manualTitle")}</DialogTitle>
            <DialogBody className="flex flex-col gap-4">
                {error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
                )}
                {savedOn && !error && <div className="text-sm text-green-600 dark:text-green-400">{t("bank.manualSaved")}</div>}
                <SegmentedControl value={direction} onChange={(d) => {
                    setDirection(d);
                    setTarget("");
                }} options={[
                    {value: "out", label: t("bank.manualOut")},
                    {value: "in", label: t("bank.manualIn")},
                ]}/>
                <div className="grid grid-cols-2 gap-4">
                    <Field>
                        <Label>{t("bank.amount")}</Label>
                        <Input inputMode="decimal" className="[&_input]:text-right" placeholder="0,00" value={amount} autoFocus
                               onChange={(e) => setAmount(e.target.value)}/>
                    </Field>
                    <Field>
                        <Label>{t("bank.date")}</Label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}/>
                    </Field>
                </div>
                <Field>
                    <Label>{t("bank.manualDescription")}</Label>
                    <Input value={counterparty} placeholder={t("bank.manualDescriptionPlaceholder")} onChange={(e) => setCounterparty(e.target.value)}/>
                </Field>
                <Field>
                    <Label>{t("bank.category")}</Label>
                    <BankTargetSelect tx={draft} contracts={contracts} categories={categories} onChange={setTarget}/>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                        <Label>{t("bank.account")}</Label>
                        <Select value={accountId} onChange={(e) => {
                            setAccountId(e.target.value);
                            setScope(e.target.value ? scopeOf(e.target.value) : "HOUSEHOLD");
                        }}>
                            <option value="">{t("bank.cash")}</option>
                            {sortedByName(accounts, (a) => a.name).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </Field>
                    <Field>
                        <Label>{t("bank.scope")}</Label>
                        <div className="mt-3">
                            <SegmentedControl value={scope} onChange={setScope} options={[
                                {value: "HOUSEHOLD", label: t("bank.scopeHousehold")},
                                {value: "PRIVATE", label: t("bank.scopePrivate")},
                            ]}/>
                        </div>
                    </Field>
                </div>
                <Field>
                    <Label>{t("bank.manualNote")}</Label>
                    <Input value={purpose} onChange={(e) => setPurpose(e.target.value)}/>
                </Field>
            </DialogBody>
            <DialogActions>
                <Button plain onClick={() => onClose(savedOn)} className="hover:cursor-pointer">{t("common.cancel")}</Button>
                {!booking && <Button outline onClick={() => save(true)} disabled={saving} className="hover:cursor-pointer">{t("bank.manualSaveAnother")}</Button>}
                <Button onClick={() => save(false)} disabled={saving} className="hover:cursor-pointer">{t("common.save")}</Button>
            </DialogActions>
        </Dialog>
    );
}

/** The assignment of a select value as booking fields, for highlighting the current choice. */
function selectedFields(value: string): Partial<BankTransactionDto> {
    const change = targetChange(value);
    return {contract_id: change.contract_id, category_id: change.category_id};
}
