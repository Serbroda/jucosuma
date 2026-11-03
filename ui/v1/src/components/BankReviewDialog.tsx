import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, LockClosedIcon, UserGroupIcon, XMarkIcon} from "@heroicons/react/16/solid";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "./catalyst/dialog.tsx";
import {Button} from "./catalyst/button.tsx";
import BankTargetSelect from "./BankTargetSelect.tsx";
import type {AccountDto, BankTransactionDto, CategoryDto, ContractDto} from "../gen/types.gen.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";
import {accountName} from "../utils/household.utils.ts";
import {type BankTarget, bankTargets, isTarget, targetChange} from "../utils/bank.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {table, td, th, tr} from "../utils/ui.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import dayjs from "../lib/dayjs";

type Change = { scope?: string; category_id?: number; contract_id?: number; clear_category?: boolean };

/** Works through the bookings of an import without category, one at a time, and ends with an
 * overview of the whole import to correct mistakes. The targets keep a fixed order, so the keys stay
 * the same: 1–9 pick a target, 0 removes the assignment, → skips, ← goes back, H switches between
 * household and only me. */
export default function BankReviewDialog({importId, contracts, categories, accounts, onClose, onCloseImport}: {
    importId: number | null;
    contracts: ContractDto[];
    categories: CategoryDto[];
    accounts: AccountDto[];
    onClose: () => void;
    onCloseImport: (importId: number) => void;
}) {
    const {t} = useTranslation();
    const {mainCurrency} = usePreferences();
    const [items, setItems] = useState<BankTransactionDto[]>([]);
    // the bookings to go through are fixed when opening, so going back shows assigned ones again
    const [queue, setQueue] = useState<number[]>([]);
    const [index, setIndex] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [withExpenses, setWithExpenses] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (importId == null) return;
        setLoaded(false);
        setIndex(0);
        setError("");
        apiFetch(`${apiBasePath}/bank_transactions?import_id=${importId}`).then(async (res) => {
            const list: BankTransactionDto[] = res.ok ? await res.json() : [];
            setItems(list);
            setQueue(list.filter((tx) => tx.category_id == null).map((tx) => tx.id));
            setLoaded(true);
        });
    }, [importId]);

    const byId = useMemo(() => new Map(items.map((tx) => [tx.id, tx])), [items]);
    const current = index < queue.length ? byId.get(queue[index]) : undefined;
    const done = loaded && index >= queue.length;
    const open = items.filter((tx) => tx.category_id == null).length;

    const groups = useMemo(() => current ? bankTargets(current, contracts, categories, withExpenses) : [],
        [current, contracts, categories, withExpenses]);
    // numbered across the groups in their fixed order
    const targets = groups.flatMap((g) => g.targets);

    useEffect(() => setWithExpenses(false), [current?.id]);

    const entryCategory = useMemo(() => new Map(contracts.map((c) => [c.id, c.category_id])), [contracts]);

    /** Sends a change of a booking and applies it locally. */
    const change = useCallback(async (id: number, body: Change) => {
        const err = await sendJson("PUT", "/bank_transactions", {ids: [id], ...body});
        if (err) {
            setError(err);
            return false;
        }
        setError("");
        const assigns = body.category_id != null || body.contract_id != null || body.clear_category;
        setItems((list) => list.map((tx) => tx.id !== id ? tx : {
            ...tx,
            scope: body.scope ?? tx.scope,
            // for an entry the server takes the category from it
            ...(assigns ? {
                contract_id: body.contract_id,
                category_id: body.contract_id != null ? entryCategory.get(body.contract_id) : body.category_id,
            } : {}),
        }));
        return true;
    }, [entryCategory]);

    const pick = useCallback(async (target: BankTarget) => {
        if (!current) return;
        const ok = await change(current.id, target.type === "entry" ? {contract_id: target.id} : {category_id: target.id});
        if (ok) setIndex((i) => i + 1);
    }, [change, current]);

    const unassign = useCallback(() => {
        if (current && current.category_id != null) change(current.id, {clear_category: true});
    }, [change, current]);

    const toggleScope = useCallback((tx: BankTransactionDto | undefined) => {
        if (tx) change(tx.id, {scope: tx.scope === "HOUSEHOLD" ? "PRIVATE" : "HOUSEHOLD"});
    }, [change]);

    useEffect(() => {
        if (importId == null || done) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
            if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, queue.length));
            else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
            else if (e.key.toLowerCase() === "h") toggleScope(current);
            else if (e.key === "0" || e.key === "Backspace") unassign();
            else if (/^[1-9]$/.test(e.key) && targets[Number(e.key) - 1]) pick(targets[Number(e.key) - 1]);
            else return;
            e.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [importId, done, queue.length, targets, pick, unassign, toggleScope, current]);

    const money = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const progress = queue.length ? Math.min(index, queue.length) / queue.length : 1;

    const scopeButton = (tx: BankTransactionDto, title: string) => (
        <button type="button" onClick={() => toggleScope(tx)} title={title}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs whitespace-nowrap hover:cursor-pointer bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700">
            {tx.scope === "HOUSEHOLD"
                ? <><UserGroupIcon className="size-3.5"/>{t("bank.scopeHousehold")}</>
                : <><LockClosedIcon className="size-3.5"/>{t("bank.scopePrivate")}</>}
        </button>
    );

    return (
        <Dialog open={importId != null} onClose={onClose} size={done ? "5xl" : "2xl"}>
            <DialogTitle>{done ? t("bank.reviewSummary") : t("bank.reviewTitle")}</DialogTitle>
            {!done && (
                <>
                    <div className="mt-3 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{width: `${progress * 100}%`}}/>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {loaded && t("bank.reviewProgress", {current: Math.min(index + 1, queue.length), total: queue.length})}
                    </div>
                </>
            )}
            <DialogBody>
                {error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4">{error}</div>
                )}
                {!loaded ? null : done ? (
                    <div className="flex flex-col gap-3">
                        <div className="text-sm text-zinc-600 dark:text-zinc-300">
                            {open > 0 ? t("bank.reviewOpenLeft", {count: open}) : t("bank.reviewAllAssigned")}
                        </div>
                        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                            <table className={table}>
                                <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                                <tr>
                                    <th className={th}>{t("bank.date")}</th>
                                    <th className={th}>{t("bank.counterparty")}</th>
                                    <th className={th + " w-44 sm:w-60"}>{t("bank.category")}</th>
                                    <th className={th + " hidden md:table-cell"}>{t("bank.scope")}</th>
                                    <th className={th + " text-right"}>{t("bank.amount")}</th>
                                </tr>
                                </thead>
                                <tbody>
                                {items.map((tx) => (
                                    <tr key={tx.id} className={tr + (tx.category_id == null ? " bg-amber-50/60 dark:bg-amber-950/20" : "")}>
                                        <td className={td + " whitespace-nowrap tabular-nums"}>{dayjs(tx.booking_date).format("DD.MM.")}</td>
                                        <td className={td + " max-w-32 sm:max-w-xs"}>
                                            <div className="truncate text-zinc-950 dark:text-white">{tx.counterparty || tx.booking_text}</div>
                                            <div className="truncate text-xs text-zinc-400 dark:text-zinc-500" title={tx.purpose}>{tx.purpose}</div>
                                        </td>
                                        <td className={td}>
                                            <BankTargetSelect tx={tx} contracts={contracts} categories={categories}
                                                              onChange={(v) => change(tx.id, targetChange(v))}/>
                                        </td>
                                        <td className={td + " hidden md:table-cell"}>{scopeButton(tx, t("bank.toggleScope"))}</td>
                                        <td className={td + " text-right whitespace-nowrap tabular-nums " + (tx.amount < 0 ? "" : "text-green-600 dark:text-green-400")}>
                                            {money(tx.amount)}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : current && (
                    <div className="flex flex-col gap-5">
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                            <div className="flex items-start gap-4">
                                <div className="grow min-w-0">
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {dayjs(current.booking_date).format("DD.MM.YYYY")} · {accountName(current.account_id, accounts)} · {current.booking_text}
                                    </div>
                                    <div className="text-lg font-semibold text-zinc-950 dark:text-white break-words">{current.counterparty || current.booking_text}</div>
                                    <div className="text-sm text-zinc-500 dark:text-zinc-400 break-words mt-1">{current.purpose}</div>
                                </div>
                                <div className={"text-xl font-semibold tabular-nums whitespace-nowrap " + (current.amount < 0 ? "text-zinc-950 dark:text-white" : "text-green-600 dark:text-green-400")}>
                                    {money(current.amount)}
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {scopeButton(current, t("bank.toggleScope") + " (H)")}
                                {current.category_id != null && (
                                    <button type="button" onClick={unassign} title={t("bank.unassign") + " (0)"}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:cursor-pointer text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                        <XMarkIcon className="size-3.5"/>{t("bank.unassign")}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-4">
                            {groups.map((group) => (
                                <div key={group.key}>
                                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">{t(`bank.group.${group.key}`)}</div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {group.targets.map((target) => {
                                            const n = targets.indexOf(target) + 1;
                                            return (
                                                <button key={target.type + target.id} type="button" onClick={() => pick(target)}
                                                        className={"flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 "
                                                            + (isTarget(current, target) ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-200 dark:border-zinc-700")}>
                                                    {n <= 9 && <kbd className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{n}</kbd>}
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-zinc-800 dark:text-zinc-200">{target.label}</span>
                                                        {target.type === "entry" && target.hint &&
                                                            <span className="block truncate text-[11px] text-zinc-400 dark:text-zinc-500">{target.hint}</span>}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {current.amount > 0 && !withExpenses && (
                                <button type="button" onClick={() => setWithExpenses(true)}
                                        className="self-start inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:cursor-pointer">
                                    <ChevronDownIcon className="size-3.5"/>{t("bank.showExpenseTargets")}
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:block">{t("bank.reviewKeys")}</p>
                    </div>
                )}
            </DialogBody>
            <DialogActions>
                {done ? (
                    <>
                        <Button plain onClick={onClose} className="hover:cursor-pointer">{t("bank.reviewPause")}</Button>
                        {open > 0 && (
                            <Button outline onClick={() => {
                                setQueue(items.filter((tx) => tx.category_id == null).map((tx) => tx.id));
                                setIndex(0);
                            }} className="hover:cursor-pointer">{t("bank.reviewAgain")}</Button>
                        )}
                        <Button onClick={() => importId != null && onCloseImport(importId)} className="hover:cursor-pointer">{t("bank.closeImport")}</Button>
                    </>
                ) : (
                    <>
                        <Button plain onClick={onClose} className="hover:cursor-pointer">{t("bank.reviewPause")}</Button>
                        <Button plain onClick={() => setIndex(queue.length)} className="hover:cursor-pointer">{t("bank.toSummary")}</Button>
                        <Button outline disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="hover:cursor-pointer">
                            <ArrowLeftIcon/>{t("common.back")}
                        </Button>
                        <Button outline onClick={() => setIndex((i) => i + 1)} className="hover:cursor-pointer">
                            {t("bank.skip")}<ArrowRightIcon/>
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
