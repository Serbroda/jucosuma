import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useRevalidator, useSearchParams} from "react-router";
import {
    ArrowsRightLeftIcon,
    ArrowUpTrayIcon,
    ArrowUturnLeftIcon,
    CheckIcon,
    ChevronDownIcon,
    LockClosedIcon,
    PencilIcon,
    PlayIcon,
    PlusIcon,
    TrashIcon,
    UserGroupIcon,
} from "@heroicons/react/16/solid";
import {ArrowDownTrayIcon, ArrowUpRightIcon, CheckCircleIcon, QuestionMarkCircleIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import BankImportDialog from "../components/BankImportDialog.tsx";
import BankReviewDialog from "../components/BankReviewDialog.tsx";
import BankTargetSelect from "../components/BankTargetSelect.tsx";
import ManualBookingDialog from "../components/ManualBookingDialog.tsx";
import MoveImportDialog from "../components/MoveImportDialog.tsx";
import BookingsCategoryChart from "../components/BookingsCategoryChart.tsx";
import {useBankActuals} from "../hooks/useBankActuals.ts";
import {Badge} from "../components/catalyst/badge.tsx";
import ConfirmDialog from "../components/dialogs/ConfirmDialog.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "../components/catalyst/dialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Checkbox} from "../components/catalyst/checkbox.tsx";
import TableToolbar from "../components/ui/TableToolbar.tsx";
import {useTableFilter} from "../hooks/useTableFilter.ts";
import type {BankImportDto, BankTransactionDto} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {sendJson} from "../lib/api.ts";
import {accountName, categoryLabel, sortedByName} from "../utils/household.utils.ts";
import {targetChange} from "../utils/bank.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {card, cardTitle, table, td, th, tr} from "../utils/ui.ts";
import dayjs from "../lib/dayjs";

type Scope = "HOUSEHOLD" | "PRIVATE";
type View = "review" | "month";

/** Imported bank bookings: open imports are worked through and closed, the month view shows all
 * bookings of a month. Bookings are private to the uploader; only their classification (category
 * sums) may count for the household. */
export default function BookingsPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {monthKey: month, setMonth} = useMonth();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [transactions, setTransactions] = useState<BankTransactionDto[]>([]);
    const [imports, setImports] = useState<BankImportDto[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<BankImportDto | null>(null);
    const [moving, setMoving] = useState<BankImportDto | null>(null);
    // manual bookings: null = closed, undefined = new one
    const [editingManual, setEditingManual] = useState<BankTransactionDto | null | undefined>(null);
    const [deletingManual, setDeletingManual] = useState<BankTransactionDto | null>(null);
    const [closing, setClosing] = useState<BankImportDto | null>(null);
    const [reviewing, setReviewing] = useState<number | null>(null);
    const [showClosed, setShowClosed] = useState(false);
    const [searchParams] = useSearchParams();
    const actuals = useBankActuals(month, true, transactions);
    const [view, setView] = useState<View>(searchParams.get("view") === "month" ? "month" : "review");
    const [retention, setRetention] = useState(3);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        const [txRes, impRes] = await Promise.all([
            apiFetch(`${apiBasePath}/bank_transactions?month=${month}`),
            apiFetch(`${apiBasePath}/bank_imports`),
        ]);
        if (txRes.ok) setTransactions(await txRes.json());
        if (impRes.ok) setImports(await impRes.json());
        setSelected(new Set());
    }, [month]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        apiFetch(`${apiBasePath}/bank_settings`).then(async (res) => res.ok && setRetention((await res.json()).raw_retention_months));
    }, []);

    const openImports = imports.filter((imp) => !imp.closed_at);
    const closedImports = imports.filter((imp) => imp.closed_at);
    const period = (imp: BankImportDto) => imp.period_from && imp.period_to
        ? `${dayjs(imp.period_from).format("DD.MM.YYYY")} – ${dayjs(imp.period_to).format("DD.MM.YYYY")}` : imp.filename;

    const closeImport = async (id: number) => {
        const err = await sendJson("PUT", `/bank_imports/${id}/close`);
        setClosing(null);
        setReviewing(null);
        if (err) return setError(err);
        load();
    };

    const reopen = async (id: number) => {
        const err = await sendJson("PUT", `/bank_imports/${id}/reopen`);
        if (err) return setError(err);
        load();
    };

    const money = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const entryCategory = useMemo(() => new Map(data.contracts.map((c) => [c.id, c.category_id])), [data.contracts]);

    const update = async (ids: number[], change: { scope?: Scope; category_id?: number; contract_id?: number; clear_category?: boolean }) => {
        const err = await sendJson("PUT", "/bank_transactions", {ids, ...change});
        if (err) return setError(err);
        setError("");
        const assigns = change.category_id != null || change.contract_id != null || change.clear_category;
        setTransactions((list) => list.map((tx) => !ids.includes(tx.id) ? tx : {
            ...tx,
            scope: change.scope ?? tx.scope,
            ...(assigns ? {
                contract_id: change.contract_id,
                category_id: change.contract_id != null ? entryCategory.get(change.contract_id) : change.category_id,
                classified_by: change.clear_category ? undefined : "MANUAL",
            } : {}),
        }));
    };

    /** Assigns a value of the target <select> ("e:12" entry, "c:3" category, "" none). */
    const assign = (ids: number[], value: string) => update(ids, targetChange(value));


    const deleteImport = async (id: number) => {
        const err = await sendJson("DELETE", `/bank_imports/${id}`);
        setDeleting(null);
        if (err) return setError(err);
        load();
    };

    const categoryById = new Map(data.categories.map((c) => [c.id, c]));
    const usedCategories = [...new Set(transactions.map((tx) => tx.category_id).filter((id): id is number => id != null))]
        .map((id) => categoryById.get(id)).filter((c) => c != null);
    const usedAccounts = [...new Set(transactions.map((tx) => tx.account_id ?? null))];
    const {filtered: listed, toolbar, isFiltered} = useTableFilter(transactions, {
        searchText: (tx) => [tx.counterparty, tx.purpose, tx.booking_text, money(tx.amount)].join(" "),
        filters: [
            {
                key: "category", label: t("bank.category"),
                options: [{value: "none", label: t("bank.unassigned")},
                    ...sortedByName(usedCategories, (c) => categoryLabel(c.name, c.key)).map((c) => ({value: String(c.id), label: categoryLabel(c.name, c.key)}))],
                test: (tx, v) => v === "none" ? tx.category_id == null : tx.category_id === Number(v),
            },
            {
                key: "scope", label: t("bank.scope"),
                options: [{value: "HOUSEHOLD", label: t("bank.scopeHousehold")}, {value: "PRIVATE", label: t("bank.scopePrivate")}],
                test: (tx, v) => tx.scope === v,
            },
            {
                key: "account", label: t("bank.account"),
                options: usedAccounts.map((id) => ({value: String(id ?? "cash"), label: accountName(id, data.accounts) ?? t("bank.cash")})),
                test: (tx, v) => String(tx.account_id ?? "cash") === v,
            },
            {
                key: "direction", label: t("bank.direction"),
                options: [{value: "out", label: t("bank.manualOut")}, {value: "in", label: t("bank.manualIn")}],
                test: (tx, v) => (tx.amount < 0) === (v === "out"),
            },
            {
                key: "source", label: t("bank.source"),
                options: [{value: "import", label: t("bank.sourceImport")}, {value: "manual", label: t("bank.manualCapital")}],
                test: (tx, v) => (tx.import_id == null) === (v === "manual"),
            },
        ],
    });
    // figures, chart and table follow search and filters
    const expenses = listed.filter((tx) => tx.amount < 0).reduce((s, tx) => s - tx.amount, 0);
    const income = listed.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
    const open = listed.filter((tx) => tx.category_id == null).length;
    const sum = (list: BankTransactionDto[]) => list.reduce((s, tx) => s + tx.amount, 0);

    // bulk actions apply to the selected bookings that are shown
    const selectedIds = listed.filter((tx) => selected.has(tx.id)).map((tx) => tx.id);
    const allSelected = listed.length > 0 && listed.every((tx) => selected.has(tx.id));
    const toggle = (id: number, on: boolean) => setSelected((s) => {
        const next = new Set(s);
        if (on) next.add(id); else next.delete(id);
        return next;
    });
    // bulk assignment: the first selected booking decides which targets are offered
    const firstSelected = listed.find((tx) => selected.has(tx.id));

    const kpis = [
        {label: t("bank.expenses"), value: money(expenses), icon: ArrowUpRightIcon, color: 4},
        {label: t("bank.income"), value: money(income), icon: ArrowDownTrayIcon, color: 2},
        {label: t("bank.open"), value: String(open), icon: QuestionMarkCircleIcon, color: 1},
    ];

    return (
        <div className="flex flex-col gap-6">
            <BankImportDialog isOpen={uploading} accounts={data.accounts} onClose={(imported) => {
                setUploading(false);
                if (imported) {
                    load();
                    revalidator.revalidate();
                }
            }}/>
            <ConfirmDialog
                isOpen={deleting != null}
                title={t("bank.deleteImportTitle")}
                message={t("bank.deleteImportMessage", {count: deleting?.imported ?? 0})}
                submitLabel={t("common.delete")}
                onClose={() => setDeleting(null)}
                onSubmit={async () => { if (deleting) await deleteImport(deleting.id); }}
            />
            <BankReviewDialog importId={reviewing} contracts={data.contracts} categories={data.categories} accounts={data.accounts}
                              onClose={() => {
                                  setReviewing(null);
                                  load();
                              }}
                              onCloseImport={(id) => {
                                  const imp = imports.find((i) => i.id === id);
                                  setReviewing(null);
                                  if (imp) setClosing(imp);
                                  load();
                              }}/>
            <Dialog open={closing != null} onClose={() => setClosing(null)}>
                <DialogTitle>{t("bank.closeImportTitle")}</DialogTitle>
                <DialogBody className="text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-2">
                    {closing && closing.total - closing.classified > 0 && (
                        <p>{t("bank.closeUnassigned", {count: closing.total - closing.classified})}</p>
                    )}
                    <p>{retention === 0 ? t("bank.closeRemovesNow") : t("bank.closeRemovesLater", {count: retention})}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("bank.closeReopenHint")}</p>
                </DialogBody>
                <DialogActions>
                    <Button plain onClick={() => setClosing(null)} className="hover:cursor-pointer">{t("common.cancel")}</Button>
                    <Button onClick={() => closing && closeImport(closing.id)} className="hover:cursor-pointer">{t("bank.closeImport")}</Button>
                </DialogActions>
            </Dialog>
            <MoveImportDialog imp={moving} accounts={data.accounts} onClose={(moved) => {
                setMoving(null);
                if (moved) load();
            }}/>
            <ManualBookingDialog open={editingManual !== null} booking={editingManual} accounts={data.accounts}
                                 contracts={data.contracts} categories={data.categories}
                                 onClose={(savedOn) => {
                                     setEditingManual(null);
                                     if (!savedOn) return;
                                     // show the month of the booking
                                     setView("month");
                                     if (savedOn.slice(0, 7) !== month) setMonth(dayjs(savedOn));
                                     else load();
                                 }}/>
            <ConfirmDialog
                isOpen={deletingManual != null}
                title={t("bank.manualDeleteTitle")}
                message={t("bank.manualDeleteMessage", {name: deletingManual?.counterparty ?? ""})}
                submitLabel={t("common.delete")}
                onClose={() => setDeletingManual(null)}
                onSubmit={async () => {
                    if (!deletingManual) return;
                    const err = await sendJson("DELETE", `/bank_transactions/${deletingManual.id}`);
                    setDeletingManual(null);
                    if (err) setError(err);
                    load();
                }}
            />
            <PageHeader title={t("bank.title")} subtitle={t("bank.subtitle")}
                        actions={<>
                            <Button outline onClick={() => setEditingManual(undefined)} className="hover:cursor-pointer"><PlusIcon/>{t("bank.manualAdd")}</Button>
                            <Button onClick={() => setUploading(true)} className="hover:cursor-pointer"><ArrowUpTrayIcon/>{t("bank.upload")}</Button>
                        </>}/>

            {error && (
                <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            <SegmentedControl value={view} onChange={setView} options={[
                {value: "review", label: openImports.length ? t("bank.viewReviewCount", {count: openImports.length}) : t("bank.viewReview")},
                {value: "month", label: t("bank.viewMonth")},
            ]}/>

            {view === "review" ? (
                <>
                    {openImports.length === 0 ? (
                        <div className={card + " text-center py-10"}>
                            <CheckCircleIcon className="size-10 mx-auto text-green-500"/>
                            <div className="mt-2 font-medium text-zinc-950 dark:text-white">{t("bank.nothingToReview")}</div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("bank.nothingToReviewHint")}</p>
                        </div>
                    ) : openImports.map((imp) => {
                        const left = imp.total - imp.classified;
                        return (
                            <div key={imp.id} className={card + " flex flex-col gap-4"}>
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="grow min-w-0">
                                        <div className="font-medium text-zinc-950 dark:text-white">{accountName(imp.account_id, data.accounts) ?? imp.bank}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {period(imp)} · {t("bank.importCounts", {imported: imp.imported, duplicates: imp.duplicates})}
                                        </div>
                                    </div>
                                    <div className="flex">
                                        <Button plain onClick={() => setMoving(imp)} title={t("bank.moveImport")} aria-label={t("bank.moveImport")} className="hover:cursor-pointer"><ArrowsRightLeftIcon/></Button>
                                        <Button plain onClick={() => setDeleting(imp)} aria-label={t("common.delete")} className="hover:cursor-pointer"><TrashIcon/></Button>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                                        <span>{t("bank.classifiedOf", {classified: imp.classified, total: imp.total})}</span>
                                        <span>{left > 0 ? t("bank.leftToReview", {count: left}) : t("bank.reviewAllAssigned")}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{width: `${imp.total ? imp.classified / imp.total * 100 : 100}%`}}/>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {left > 0 && <Button onClick={() => setReviewing(imp.id)} className="hover:cursor-pointer"><PlayIcon/>{t("bank.review")}</Button>}
                                    <Button outline onClick={() => setClosing(imp)} className="hover:cursor-pointer"><CheckIcon/>{t("bank.closeImport")}</Button>
                                </div>
                            </div>
                        );
                    })}

                    {closedImports.length > 0 && (
                        <div className={card}>
                            <button type="button" onClick={() => setShowClosed((s) => !s)}
                                    className="flex w-full items-center gap-2 hover:cursor-pointer text-left">
                                <span className={cardTitle + " grow"}>{t("bank.closedImports", {count: closedImports.length})}</span>
                                <ChevronDownIcon className={"size-4 text-zinc-400 transition-transform " + (showClosed ? "rotate-180" : "")}/>
                            </button>
                            {showClosed && (
                                <table className={table + " mt-3"}>
                                    <tbody>
                                    {closedImports.map((imp) => (
                                        <tr key={imp.id} className={tr}>
                                            <td className={td}>
                                                <div className="text-zinc-950 dark:text-white">{accountName(imp.account_id, data.accounts) ?? imp.bank}</div>
                                                <div className="text-xs text-zinc-400 dark:text-zinc-500">{period(imp)}</div>
                                            </td>
                                            <td className={td + " text-xs text-zinc-500 dark:text-zinc-400 hidden sm:table-cell"}>
                                                <div>{t("bank.classifiedOf", {classified: imp.classified, total: imp.total})}</div>
                                                <div>{imp.purged_at
                                                    ? t("bank.detailsRemoved")
                                                    : imp.purge_on && t("bank.detailsRemovedOn", {date: dayjs(imp.purge_on).format("DD.MM.YYYY")})}</div>
                                            </td>
                                            <td className={td + " text-right whitespace-nowrap"}>
                                                {!imp.purged_at && (
                                                    <Button plain onClick={() => reopen(imp.id)} title={t("bank.reopen")} aria-label={t("bank.reopen")} className="hover:cursor-pointer">
                                                        <ArrowUturnLeftIcon/>
                                                    </Button>
                                                )}
                                                <Button plain onClick={() => setMoving(imp)} title={t("bank.moveImport")} aria-label={t("bank.moveImport")} className="hover:cursor-pointer"><ArrowsRightLeftIcon/></Button>
                                                <Button plain onClick={() => setDeleting(imp)} aria-label={t("common.delete")} className="hover:cursor-pointer"><TrashIcon/></Button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>

                <TableToolbar state={toolbar}
                              title={isFiltered ? <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                  {t("bank.filteredInfo", {shown: listed.length, total: transactions.length})}</span> : undefined}/>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {kpis.map((k) => (
                        <div key={k.label} className={card + " flex items-center gap-4"}>
                            <IconTile iconComponent={k.icon} color={k.color} className="size-11"/>
                            <div>
                                <div className="text-sm text-zinc-500 dark:text-zinc-400">{k.label}</div>
                                <div className="text-2xl font-semibold text-zinc-950 dark:text-white">{k.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <BookingsCategoryChart transactions={listed} actuals={actuals} filtered={isFiltered} categories={data.categories}
                                       format={(v) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency, maximumFractionDigits: v >= 100 ? 0 : 2}).format(v)}/>

                <div className={card}>
                    <div className={cardTitle + " mb-3"}>{t("bank.listTitle")}</div>

                    {selectedIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mb-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2 text-sm">
                            <span className="text-zinc-600 dark:text-zinc-300 px-1">
                                {t("bank.selected", {count: selectedIds.length})} · <span className="tabular-nums">{money(sum(listed.filter((tx) => selected.has(tx.id))))}</span>
                            </span>
                            <div className="w-56">
                                {firstSelected && <BankTargetSelect tx={firstSelected} contracts={data.contracts} categories={data.categories}
                                                                    placeholder={t("bank.setCategory")} onChange={(v) => assign(selectedIds, v)}/>}
                            </div>
                            <Button outline onClick={() => update(selectedIds, {scope: "HOUSEHOLD"})} className="hover:cursor-pointer">
                                <UserGroupIcon/>{t("bank.scopeHousehold")}
                            </Button>
                            <Button outline onClick={() => update(selectedIds, {scope: "PRIVATE"})} className="hover:cursor-pointer">
                                <LockClosedIcon/>{t("bank.scopePrivate")}
                            </Button>
                        </div>
                    )}

                    {listed.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 py-6 text-center">
                            {transactions.length === 0 ? t("bank.empty") : isFiltered ? t("bank.noMatch") : t("bank.allClassified")}
                        </p>
                    ) : (
                        <div className="overflow-x-auto relative">
                            <table className={table}>
                                <thead>
                                <tr>
                                    <th className={th + " w-8"}>
                                        <Checkbox checked={allSelected} aria-label={t("bank.selectAll")}
                                                  onChange={(on) => setSelected(on ? new Set(listed.map((tx) => tx.id)) : new Set())}/>
                                    </th>
                                    <th className={th}>{t("bank.date")}</th>
                                    <th className={th}>{t("bank.counterparty")}</th>
                                    <th className={th + " w-40 sm:w-56"}>{t("bank.category")}</th>
                                    <th className={th + " hidden md:table-cell"}>{t("bank.scope")}</th>
                                    <th className={th + " text-right"}>{t("bank.amount")}</th>
                                    <th className={th + " w-16"}><span className="sr-only">{t("common.actions")}</span></th>
                                </tr>
                                </thead>
                                <tbody>
                                {listed.map((tx) => {
                                    return (
                                        <tr key={tx.id} className={tr}>
                                            <td className={td}>
                                                <Checkbox checked={selected.has(tx.id)} onChange={(on) => toggle(tx.id, on)} aria-label={tx.counterparty}/>
                                            </td>
                                            <td className={td + " whitespace-nowrap tabular-nums"}>{dayjs(tx.booking_date).format("DD.MM.")}</td>
                                            <td className={td + " max-w-32 sm:max-w-xs"}>
                                                <div className="truncate text-zinc-950 dark:text-white">
                                                    {tx.counterparty || tx.booking_text}
                                                    {tx.import_id == null && <Badge color="zinc" className="ml-2">{t("bank.manual")}</Badge>}
                                                </div>
                                                <div className="truncate text-xs text-zinc-400 dark:text-zinc-500" title={tx.purpose}>
                                                    {[data.accounts.length > 1 || tx.account_id == null ? accountName(tx.account_id, data.accounts) ?? t("bank.cash") : "", tx.purpose]
                                                        .filter(Boolean).join(" · ")}
                                                </div>
                                            </td>
                                            <td className={td}>
                                                <BankTargetSelect tx={tx} contracts={data.contracts} categories={data.categories}
                                                                  onChange={(v) => assign([tx.id], v)}/>
                                            </td>
                                            <td className={td + " hidden md:table-cell"}>
                                                <button type="button" onClick={() => update([tx.id], {scope: tx.scope === "HOUSEHOLD" ? "PRIVATE" : "HOUSEHOLD"})}
                                                        title={t("bank.toggleScope")}
                                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:cursor-pointer bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                                    {tx.scope === "HOUSEHOLD"
                                                        ? <><UserGroupIcon className="size-3.5"/>{t("bank.scopeHousehold")}</>
                                                        : <><LockClosedIcon className="size-3.5"/>{t("bank.scopePrivate")}</>}
                                                </button>
                                            </td>
                                            <td className={td + " text-right whitespace-nowrap tabular-nums " + (tx.amount < 0 ? "" : "text-green-600 dark:text-green-400")}>
                                                {money(tx.amount)}
                                            </td>
                                            <td className={td + " text-right whitespace-nowrap"}>
                                                {tx.import_id == null && (
                                                    <>
                                                        <Button plain onClick={() => setEditingManual(tx)} aria-label={t("common.edit")} className="hover:cursor-pointer"><PencilIcon/></Button>
                                                        <Button plain onClick={() => setDeletingManual(tx)} aria-label={t("common.delete")} className="hover:cursor-pointer"><TrashIcon/></Button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                                <tfoot>
                                <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 font-medium text-zinc-950 dark:text-white">
                                    <td className={td} colSpan={3}>{t("bank.sumOf", {count: listed.length})}</td>
                                    <td className={td}/>
                                    <td className={td + " hidden md:table-cell"}/>
                                    <td className={td + " text-right whitespace-nowrap tabular-nums"}>{money(sum(listed))}</td>
                                    <td className={td}/>
                                </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">{t("bank.scopeHint")}</p>
                </div>

                </>
            )}
        </div>
    );
}
