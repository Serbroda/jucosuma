import {useEffect, useMemo, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import type {Dayjs} from "dayjs";
import FormDialog from "./FormDialog.tsx";
import {Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Textarea} from "../catalyst/textarea.tsx";
import IconTile from "../ui/IconTile.tsx";
import type {AppData} from "../../hooks/useAppData.ts";
import {summarizeMonth} from "../../utils/budget.utils.ts";
import {variableCategories} from "../../utils/closing.utils.ts";
import {accountOwnerLabel, categoryLabel} from "../../utils/household.utils.ts";
import {formatDecimal, numberLocale, parseAmount} from "../../utils/number.utils.ts";
import {usePreferences} from "../../stores/usePreferences.ts";
import {sendJson} from "../../lib/api.ts";
import {table, td, th} from "../../utils/ui.ts";

/** Records the real account balances (and optional actual category totals) at the end of a month. */
export default function ClosingDialog({open, onClose, month, data}: {
    open: boolean;
    onClose: () => void;
    month: Dayjs;
    data: AppData;
}) {
    const {t} = useTranslation();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const monthKey = month.format("YYYY-MM");
    const previousKey = month.subtract(1, "month").format("YYYY-MM");
    const closing = data.closings.find((c) => c.month === monthKey);
    const previous = data.closings.find((c) => c.month === previousKey);
    const needsStart = !previous;

    const [ends, setEnds] = useState<Record<number, string>>({});
    const [starts, setStarts] = useState<Record<number, string>>({});
    const [actuals, setActuals] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState("");
    // account balances are optional; shown when the closing already has some or on request
    const [showBalances, setShowBalances] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const plan = useMemo(() => summarizeMonth(data.contracts, data.persons, data.accounts, month, "due", mainCurrency, "all"),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [data, monthKey, mainCurrency]);
    const plannedChange = (accountId: number) => {
        const f = plan.accounts.find((a) => a.account.id === accountId);
        return f ? f.inflow - f.outflow : 0;
    };
    const categories = useMemo(() => variableCategories(month, data.closings, data.contracts, data.categories),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [data, monthKey]);

    useEffect(() => {
        if (!open) return;
        const fromBalances = (balances?: { account_id: number; balance: number }[]) =>
            Object.fromEntries((balances ?? []).map((b) => [b.account_id, formatDecimal(b.balance) || "0,00"]));
        setEnds(fromBalances(closing?.balances));
        setStarts(Object.fromEntries(data.accounts
            .filter((a) => a.balance != null)
            .map((a) => [a.id, formatDecimal(a.balance) || "0,00"])));
        setActuals(Object.fromEntries((closing?.actuals ?? []).map((a) => [a.category_id, formatDecimal(a.amount) || "0,00"])));
        setNotes(closing?.notes ?? "");
        setShowBalances((closing?.balances.length ?? 0) > 0);
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, monthKey]);

    /** Expected end balance: start balance plus the planned change of the month. */
    const expected = (accountId: number): number | undefined => {
        const start = previous?.balances.find((b) => b.account_id === accountId)?.balance ?? parseAmount(starts[accountId]);
        return start == null ? undefined : start + plannedChange(accountId);
    };

    const toBalances = (values: Record<number, string>) => Object.entries(values)
        .map(([id, v]) => ({account_id: Number(id), balance: parseAmount(v)}))
        .filter((b): b is { account_id: number; balance: number } => b.balance != null);

    const save = async () => {
        const balances = showBalances ? toBalances(ends) : [];
        setSaving(true);
        setError(null);
        // first closing: store the start balances as closing of the previous month
        if (needsStart && balances.length > 0) {
            const startBalances = toBalances(starts);
            if (startBalances.length > 0) {
                const err = await sendJson("PUT", `/month_closings/${previousKey}`, {balances: startBalances, actuals: []});
                if (err) {
                    setSaving(false);
                    return setError(err);
                }
            }
        }
        const err = await sendJson("PUT", `/month_closings/${monthKey}`, {
            notes: notes.trim() || null,
            balances,
            actuals: Object.entries(actuals)
                .map(([id, v]) => ({category_id: Number(id), amount: parseAmount(v)}))
                .filter((a) => a.amount != null),
        });
        setSaving(false);
        if (err) return setError(err);
        revalidator.revalidate();
        onClose();
    };

    const monthEnd = month.endOf("month").format("DD.MM.YYYY");

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error} size="2xl"
                    title={t('closing.dialogTitle', {month: month.format("MMMM YYYY")})}>
            <div>
                <div className="text-sm font-semibold text-zinc-950 dark:text-white">{t('closing.actualsTitle')}</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {categories.length > 0 ? t('closing.actualsHint') : t('closing.noVariable')}
                </p>
                {categories.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                        {categories.map((c) => {
                            const planned = plan.byCategory.find((b) => b.id === c.id)?.amount ?? 0;
                            return (
                                <div key={c.id} className="grid grid-cols-[1fr_7rem] sm:grid-cols-[1fr_7rem_8rem] items-center gap-3">
                                    <span className="flex items-center gap-2 min-w-0">
                                        <IconTile icon={c.icon} color={c.color} className="size-7"/>
                                        <span className="min-w-0">
                                            <span className="block text-sm text-zinc-950 dark:text-white truncate">{categoryLabel(c.name, c.key)}</span>
                                            {/* on phones the plan sits below the name */}
                                            <span className="block sm:hidden text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                {t('closing.plan', {amount: format(planned)})}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="hidden sm:block text-xs text-right text-zinc-500 dark:text-zinc-400 tabular-nums">
                                        {t('closing.plan', {amount: format(planned)})}
                                    </span>
                                    <Input inputMode="decimal" className="text-right" placeholder={t('closing.actualPlaceholder')}
                                           aria-label={`${t('closing.actual')} ${categoryLabel(c.name, c.key)}`}
                                           value={actuals[c.id] ?? ""}
                                           onChange={(e) => setActuals({...actuals, [c.id]: e.target.value})}/>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showBalances ? (
                <div>
                    <div className="text-sm font-semibold text-zinc-950 dark:text-white">{t('closing.balancesTitle', {date: monthEnd})}</div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {needsStart ? t('closing.balancesHintFirst') : t('closing.balancesHint')}
                    </p>
                    <div className="overflow-x-auto -mx-2 mt-2">
                        <table className={table}>
                            <thead>
                            <tr>
                                <th className={th}>{t('closing.account')}</th>
                                {needsStart && <th className={th + " text-right"}>{t('closing.startBalance')}</th>}
                                <th className={th + " text-right"}>{t('closing.endBalance')}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {data.accounts.map((a) => {
                                const exp = expected(a.id);
                                return (
                                    <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-800">
                                        <td className={td}>
                                            <div className="font-medium text-zinc-950 dark:text-white">{a.name}</div>
                                            <div className="text-xs text-zinc-400 dark:text-zinc-500">{accountOwnerLabel(a, data.persons)}</div>
                                        </td>
                                        {needsStart && (
                                            <td className={td + (needsStart ? " w-28 sm:w-36" : " w-36")}>
                                                <Input inputMode="decimal" className="text-right" placeholder="0,00"
                                                       aria-label={`${t('closing.startBalance')} ${a.name}`}
                                                       value={starts[a.id] ?? ""}
                                                       onChange={(e) => setStarts({...starts, [a.id]: e.target.value})}/>
                                            </td>
                                        )}
                                        <td className={td + (needsStart ? " w-28 sm:w-36" : " w-36")}>
                                            <Input inputMode="decimal" className="text-right"
                                                   aria-label={`${t('closing.endBalance')} ${a.name}`}
                                                   placeholder={exp != null ? formatDecimal(exp) || "0,00" : "0,00"}
                                                   value={ends[a.id] ?? ""}
                                                   onChange={(e) => setEnds({...ends, [a.id]: e.target.value})}/>
                                            {exp != null && (
                                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 text-right mt-0.5">
                                                    {t('closing.expected', {amount: format(exp)})}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>

                </div>
            ) : (
                <div>
                    <button type="button" onClick={() => setShowBalances(true)}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline hover:cursor-pointer">
                        {t('closing.addBalances')}
                    </button>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('closing.addBalancesHint')}</p>
                </div>
            )}

            <Field>
                <Label>{t('entryForm.notes')}</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('closing.notesPlaceholder')}/>
            </Field>
        </FormDialog>
    );
}
