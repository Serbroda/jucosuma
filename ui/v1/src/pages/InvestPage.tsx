import {useEffect, useState} from "react";
import {useBlocker, useLoaderData, useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {DocumentDuplicateIcon, PlusIcon, TrashIcon} from "@heroicons/react/20/solid";
import {XMarkIcon} from "@heroicons/react/16/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import DonutChart, {type DonutSegment} from "../components/charts/DonutChart.tsx";
import ConfirmDialog from "../components/dialogs/ConfirmDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Select} from "../components/catalyst/select.tsx";
import {
    InvestModeFixed,
    InvestModePercent,
    type AccountDto,
    type InvestPlanDto,
    type PersonDto,
    type SaveInvestPlanDto,
} from "../gen/types.gen.ts";
import {useAuth} from "../stores/useAuth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {allocateInvestPlan} from "../utils/invest.utils.ts";
import {sortedByName} from "../utils/household.utils.ts";
import {numberLocale, parseAmount} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {card, cardTitle} from "../utils/ui.ts";
import {slotColor, colorSlots} from "../lib/icons.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";

type Row = { key: number; name: string; mode: string; value: string; accountId: string };
/** The plan being edited; what is typed stays text until it is saved. */
type Draft = { id?: number; name: string; amount: string; rows: Row[] };

let nextKey = 1;
const emptyRow = (): Row => ({key: nextKey++, name: "", mode: InvestModePercent, value: "", accountId: ""});
const numberText = (value: number) => value ? value.toLocaleString(numberLocale(), {maximumFractionDigits: 2}) : "";

function toDraft(plan: InvestPlanDto | undefined, newName: string): Draft {
    if (!plan) return {name: newName, amount: "", rows: [emptyRow(), emptyRow()]};
    return {
        id: plan.id,
        name: plan.name,
        amount: numberText(plan.amount),
        rows: plan.items.map((item) => ({
            key: nextKey++, name: item.name, mode: item.mode, value: numberText(item.value),
            accountId: item.account_id != null ? String(item.account_id) : "",
        })),
    };
}

/** What saving the draft sends; rows nothing was typed into are left out. */
function toPayload(draft: Draft): SaveInvestPlanDto {
    return {
        name: draft.name.trim(),
        amount: Math.max(0, parseAmount(draft.amount) ?? 0),
        items: draft.rows.filter((row) => row.name.trim() || row.value.trim()).map((row) => ({
            name: row.name.trim(),
            mode: row.mode,
            value: Math.max(0, parseAmount(row.value) ?? 0),
            account_id: row.accountId ? Number(row.accountId) : undefined,
        })),
    };
}

/** Invest plans: a monthly amount spread over positions by percentage or fixed amount. Private to the user. */
export default function InvestPage() {
    const {investPlans: plans, accounts, persons} = useLoaderData() as { investPlans: InvestPlanDto[]; accounts: AccountDto[]; persons: PersonDto[] };
    const {t} = useTranslation();
    const {user} = useAuth();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();

    const [draft, setDraft] = useState<Draft>(() => toDraft(plans[0], t('invest.newName')));
    // what the draft looked like when it was opened or saved
    const [saved, setSaved] = useState(() => JSON.stringify(toPayload(draft)));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    // action waiting for the user to discard unsaved changes
    const [pending, setPending] = useState<(() => void) | null>(null);

    const payload = toPayload(draft);
    const dirty = JSON.stringify(payload) !== saved;

    const open = (next: Draft, asSaved = true) => {
        setDraft(next);
        setSaved(asSaved ? JSON.stringify(toPayload(next)) : "");
        setError(null);
    };
    const guarded = (action: () => void) => dirty ? setPending(() => action) : action();

    const blocker = useBlocker(({currentLocation, nextLocation}) =>
        dirty && currentLocation.pathname !== nextLocation.pathname);
    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const money = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const moneyRound = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency, maximumFractionDigits: 0}).format(v);
    const currencySymbol = new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency})
        .formatToParts(0).find((p) => p.type === "currency")?.value ?? mainCurrency;
    const percentText = (v: number) => v.toLocaleString(numberLocale(), {maximumFractionDigits: 1});

    // shared accounts and the user's own; another login's private accounts are not offered
    const ownAccounts = sortedByName(accounts.filter((a) => {
        const owner = persons.find((p) => p.id === a.person_id);
        return !owner || owner.user_id == null || owner.user_id === user?.id;
    }), (a) => a.name);

    const amount = payload.amount;
    const positions = draft.rows.map((row) => ({mode: row.mode, value: Math.max(0, parseAmount(row.value) ?? 0)}));
    const allocation = allocateInvestPlan(amount, positions);
    const hasPercent = positions.some((p) => p.mode === InvestModePercent && p.value > 0);
    const color = (index: number) => slotColor(colorSlots[index % colorSlots.length]);

    const segments: DonutSegment[] = draft.rows
        .map((row, i) => ({key: String(row.key), label: row.name.trim() || t('invest.unnamed'), value: allocation.amounts[i], color: color(i)}))
        .filter((s) => s.value > 0);
    if (allocation.unallocated > 0.005 && segments.length > 0) {
        segments.push({key: "unallocated", label: t('invest.unallocated'), value: allocation.unallocated, color: slotColor(null)});
    }

    const setRow = (key: number, change: Partial<Row>) =>
        setDraft({...draft, rows: draft.rows.map((row) => row.key === key ? {...row, ...change} : row)});

    const save = async () => {
        if (!payload.name) return setError(t('invest.errorName'));
        if (payload.items.some((item) => !item.name)) return setError(t('invest.errorPositionName'));
        setSaving(true);
        const res = await apiFetch(`${apiBasePath}/invest_plans${draft.id ? `/${draft.id}` : ""}`, {
            method: draft.id ? "PUT" : "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });
        setSaving(false);
        if (!res.ok) {
            const text = await res.text();
            try {
                return setError(JSON.parse(text).message ?? text);
            } catch {
                return setError(text || res.statusText);
            }
        }
        open(toDraft(await res.json(), ""));
        revalidator.revalidate();
    };

    const remove = async () => {
        const err = draft.id ? await sendJson("DELETE", `/invest_plans/${draft.id}`) : null;
        setConfirmDelete(false);
        if (err) return setError(err);
        open(toDraft(plans.find((p) => p.id !== draft.id), t('invest.newName')));
        revalidator.revalidate();
    };

    const chip = (active: boolean) => classNames(
        "rounded-full px-3 py-1 text-sm border transition-colors hover:cursor-pointer",
        active
            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
    );
    const balanced = Math.abs(allocation.unallocated) < 0.005;

    return (
        <div className="flex flex-col gap-6">
            <ConfirmDialog
                isOpen={pending != null || blocker.state === "blocked"}
                title={t('entryForm.unsavedTitle')}
                message={t('invest.unsavedMessage')}
                submitLabel={t('entryForm.discard')}
                cancelLabel={t('entryForm.keepEditing')}
                onClose={() => {
                    setPending(null);
                    blocker.reset?.();
                }}
                onSubmit={async () => {
                    pending?.();
                    setPending(null);
                    blocker.proceed?.();
                }}
            />
            <ConfirmDialog
                isOpen={confirmDelete}
                title={t('common.delete')}
                message={t('invest.deleteMessage', {name: draft.name})}
                submitLabel={t('common.delete')}
                onClose={() => setConfirmDelete(false)}
                onSubmit={remove}
            />

            <PageHeader title={t('invest.title')} subtitle={t('invest.subtitle')}
                        actions={<Button onClick={() => guarded(() => open(toDraft(undefined, t('invest.newName'))))}
                                         className="hover:cursor-pointer"><PlusIcon/>{t('invest.add')}</Button>}/>

            {(plans.length > 1 || (plans.length === 1 && !draft.id)) && (
                <div className="flex flex-wrap gap-2">
                    {plans.map((plan) => (
                        <button key={plan.id} type="button" className={chip(plan.id === draft.id)} aria-pressed={plan.id === draft.id}
                                onClick={() => plan.id !== draft.id && guarded(() => open(toDraft(plan, "")))}>
                            {plan.name}
                        </button>
                    ))}
                    {!draft.id && <span className={chip(true)}>{draft.name.trim() || t('invest.newName')}</span>}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className={classNames(card, "xl:col-span-2 flex flex-col gap-5")}>
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem] gap-4">
                        <Field>
                            <Label>{t('invest.planName')}</Label>
                            <Input value={draft.name} maxLength={128} onChange={(e) => setDraft({...draft, name: e.target.value})}/>
                        </Field>
                        <Field>
                            <Label>{t('invest.amount', {currency: currencySymbol})}</Label>
                            <Input type="text" inputMode="decimal" placeholder="0" className="[&_input]:text-right" value={draft.amount}
                                   onChange={(e) => setDraft({...draft, amount: e.target.value})}/>
                        </Field>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className={cardTitle}>{t('invest.positions')}</div>
                        {draft.rows.map((row, i) => {
                            const label = row.name.trim() || t('invest.position', {number: i + 1});
                            const part = allocation.amounts[i];
                            return (
                                <div key={row.key}
                                     className="grid grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_2rem] lg:grid-cols-[minmax(0,1.3fr)_5.5rem_4.5rem_minmax(0,1fr)_6.5rem_2rem] items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 lg:border-0 lg:pb-0">
                                    <div className="col-span-3 lg:col-span-1 flex items-center gap-2">
                                        <span className="size-2.5 shrink-0 rounded-full" style={{background: color(i)}}/>
                                        <Input value={row.name} maxLength={128} aria-label={t('invest.positionName', {number: i + 1})}
                                               placeholder={t('invest.positionPlaceholder')}
                                               onChange={(e) => setRow(row.key, {name: e.target.value})}/>
                                    </div>
                                    <Input type="text" inputMode="decimal" placeholder="0" className="order-3 lg:order-none [&_input]:text-right"
                                           aria-label={t('invest.valueOf', {name: label})} value={row.value}
                                           onChange={(e) => setRow(row.key, {value: e.target.value})}/>
                                    <Select className="order-4 lg:order-none" aria-label={t('invest.unitOf', {name: label})} value={row.mode}
                                            onChange={(e) => setRow(row.key, {mode: e.target.value})}>
                                        <option value={InvestModePercent}>%</option>
                                        <option value={InvestModeFixed}>{currencySymbol}</option>
                                    </Select>
                                    <Select className="order-6 lg:order-none col-span-4 lg:col-span-1" aria-label={t('invest.accountOf', {name: label})}
                                            value={row.accountId} onChange={(e) => setRow(row.key, {accountId: e.target.value})}>
                                        <option value="">{t('invest.noAccount')}</option>
                                        {ownAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </Select>
                                    <div className="order-5 lg:order-none col-span-2 lg:col-span-1 text-right tabular-nums leading-tight">
                                        <div className="text-sm font-medium text-zinc-950 dark:text-white whitespace-nowrap">{money(part)}</div>
                                        {amount > 0 && part > 0 && (
                                            <div className="text-xs text-zinc-400 dark:text-zinc-500">{percentText(part / amount * 100)} %</div>
                                        )}
                                    </div>
                                    <button type="button" aria-label={t('invest.removePosition', {name: label})} title={t('common.delete')}
                                            onClick={() => setDraft({...draft, rows: draft.rows.filter((r) => r.key !== row.key)})}
                                            className="order-2 lg:order-none justify-self-end rounded-md p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 hover:cursor-pointer">
                                        <XMarkIcon className="size-4"/>
                                    </button>
                                </div>
                            );
                        })}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <Button plain onClick={() => setDraft({...draft, rows: [...draft.rows, emptyRow()]})} className="hover:cursor-pointer">
                                <PlusIcon/>{t('invest.addPosition')}
                            </Button>
                            <div className="ml-auto text-right text-sm" role="status">
                                {amount <= 0 ? (
                                    <span className="text-zinc-500 dark:text-zinc-400">{t('invest.enterAmount')}</span>
                                ) : balanced ? (
                                    <span className="text-zinc-500 dark:text-zinc-400">{t('invest.balanced', {amount: money(amount)})}</span>
                                ) : allocation.unallocated > 0 ? (
                                    <span className="text-amber-700 dark:text-amber-400">{t('invest.left', {amount: money(allocation.unallocated)})}</span>
                                ) : (
                                    <span className="text-red-600 dark:text-red-400">{t('invest.over', {amount: money(-allocation.unallocated)})}</span>
                                )}
                                {amount > 0 && !balanced && hasPercent && Math.abs(allocation.percent - 100) > 0.005 && (
                                    <div className="text-xs text-zinc-400 dark:text-zinc-500">{t('invest.percentSum', {percent: percentText(allocation.percent)})}</div>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t('invest.hint')}</p>
                    </div>

                    {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
                    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                        {draft.id != null && (
                            <>
                                <Button plain onClick={() => setConfirmDelete(true)} className="hover:cursor-pointer"><TrashIcon/>{t('common.delete')}</Button>
                                <Button plain className="hover:cursor-pointer" onClick={() => open({
                                    ...draft, id: undefined, name: t('invest.copyName', {name: draft.name.trim()}),
                                    rows: draft.rows.map((row) => ({...row, key: nextKey++})),
                                }, false)}>
                                    <DocumentDuplicateIcon/>{t('invest.duplicate')}
                                </Button>
                            </>
                        )}
                        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">{dirty ? t('entryForm.unsaved') : draft.id != null ? t('invest.saved') : ""}</span>
                        <Button onClick={save} disabled={saving || !dirty} className="hover:cursor-pointer">
                            {saving ? t('common.saving') : t('common.save')}
                        </Button>
                    </div>
                </div>

                <div className={classNames(card, "flex flex-col gap-4")}>
                    <div className={cardTitle}>{t('invest.distribution')}</div>
                    <DonutChart segments={segments} centerValue={moneyRound(amount)} centerLabel={t('invest.perMonth')}
                                format={money} emptyText={t('invest.emptyChart')} shareBase={amount} stacked/>
                    {amount > 0 && segments.length > 0 && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">{t('invest.perYear', {amount: moneyRound(amount * 12)})}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
