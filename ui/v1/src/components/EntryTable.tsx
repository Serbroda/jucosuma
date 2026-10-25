import type {ReactNode} from "react";
import {useNavigate, useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {ArrowRightIcon} from "@heroicons/react/16/solid";
import {ArrowsRightLeftIcon} from "@heroicons/react/20/solid";
import EntryIcon from "./EntryIcon.tsx";
import CategoryBadge from "./ui/CategoryBadge.tsx";
import RowActions from "./ui/RowActions.tsx";
import IconTile from "./ui/IconTile.tsx";
import TableToolbar from "./ui/TableToolbar.tsx";
import {Badge} from "./catalyst/badge.tsx";
import Tooltip from "./Tooltip.tsx";
import type {Dayjs} from "dayjs";
import {
    BillingPeriodMonthly, BillingPeriodNone, EntryKindTransfer, TransferTypeSaving, TransferTypeWithdrawal, type ContractDto,
} from "../gen/types.gen.ts";
import type {AppData} from "../hooks/useAppData.ts";
import {amountInMonth, intervalMonths, type Pot, potOf, splitText, costOwner, transferTypeOf} from "../utils/budget.utils.ts";
import {useTableFilter} from "../hooks/useTableFilter.ts";
import {entryFilters, entrySearchText} from "../utils/entryFilters.ts";
import {accountName, categoryLabel, goalStyle} from "../utils/household.utils.ts";
import {useSort} from "../utils/sort.utils.ts";
import SortableTh from "./ui/SortableTh.tsx";
import {entryIntervalLabel} from "../utils/data.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {table, td, th, tr} from "../utils/ui.ts";
import {sendJson} from "../lib/api.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {classNames} from "../utils/dom.utils.ts";

/** "Alle 6 Wochen" → "alle 6 Wochen": only the first letter, nouns keep their capital. */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export type EntryColumn = "interval" | "earner" | "account" | "transfer" | "transferType" | "split" | "person" | "category" | "goal";

/** Table of entries with configurable columns, search, filters and edit/delete actions. */
export default function EntryTable({entries, data, columns, emptyText, amountTone, sortId, title, controls, toolbar = true, perMonth}: {
    entries: ContractDto[];
    /** heading of the table, shown in the toolbar */
    title?: ReactNode;
    /** page specific controls next to the title, e.g. tabs */
    controls?: ReactNode;
    /** search field and filters above the table */
    toolbar?: boolean;
    /** remembers the sorting per table; defaults to the column set */
    sortId?: string;
    data: AppData;
    columns: EntryColumn[];
    emptyText: string;
    amountTone?: "income";
    /** shows amounts converted to this month (e.g. yearly / 12), the stored amount on hover */
    perMonth?: Dayjs;
}) {
    const {t, i18n} = useTranslation();
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const {mainCurrency} = usePreferences();
    const format = (v: number, currency?: string | null) =>
        new Intl.NumberFormat(numberLocale(), {style: "currency", currency: currency || mainCurrency}).format(v);
    const has = (c: EntryColumn) => columns.includes(c);
    const amountOf = (c: ContractDto) => perMonth ? amountInMonth(c, perMonth, "average") : c.costs ?? 0;
    const potLabel = (pot: Pot) => pot === "household"
        ? t('overview.potHousehold') : data.persons.find((p) => p.id === pot)?.name ?? t('common.unknown');
    const categoryOf = (c: ContractDto) => data.categories.find((cat) => cat.id === c.category_id);
    const earnerLabel = (c: ContractDto) => {
        const earner = costOwner(c, data.persons, data.accounts);
        return earner === "household" ? t('income.earnerShared') : data.persons.find((p) => p.id === earner)?.name;
    };
    const accountById = new Map(data.accounts.map((a) => [a.id, a]));
    const transferTypeLabel = (c: ContractDto) => t(`transferType.${transferTypeOf(c, accountById) as "saving" | "withdrawal" | "move"}`);
    const {filtered, toolbar: filterState, isFiltered} = useTableFilter(entries, {
        searchText: (c) => entrySearchText(c, data),
        filters: entryFilters(entries, data, t),
    });
    const {sorted, sort, toggle} = useSort(`entries:${sortId ?? columns.join(",")}`, filtered, {
        name: (c) => c.name,
        amount: (c) => amountOf(c),
        interval: (c) => c.billing_period === BillingPeriodNone ? Infinity : intervalMonths(c),
        earner: earnerLabel,
        account: (c) => accountName(c.account_id, data.accounts),
        transfer: (c) => `${accountName(c.account_id, data.accounts) ?? ""} ${accountName(c.target_account_id, data.accounts) ?? ""}`,
        transferType: transferTypeLabel,
        split: (c) => splitText(c, data.persons, data.accounts, t('common.household'), i18n.language),
        person: (c) => potLabel(potOf(data.accounts.find((a) => a.id === c.account_id))),
        goal: (c) => data.goals.find((g) => g.id === c.goal_id)?.name,
        category: (c) => {
            const cat = categoryOf(c);
            return cat ? categoryLabel(cat.name, cat.key) : c.category;
        },
    });
    const head = (key: EntryColumn | "name" | "amount", label: string, className: string, align?: "right") => (
        <SortableTh sortKey={key} sort={sort} onSort={toggle} className={className} align={align}>{label}</SortableTh>
    );

    return (
        <>
        {toolbar && <TableToolbar title={title} state={filterState}>{controls}</TableToolbar>}
        <div className="overflow-x-auto -mx-5">
            <table className={table}>
                <thead>
                <tr>
                    {head("name", t('common.name'), classNames(th, "pl-5"))}
                    {head("amount", perMonth ? t('entry.amountPerMonth') : t('entry.amount'), classNames(th, "text-right"), "right")}
                    {has("interval") && head("interval", t('entry.interval'), classNames(th, "hidden md:table-cell"))}
                    {has("earner") && head("earner", t('income.earner'), classNames(th, "hidden sm:table-cell"))}
                    {has("account") && head("account", t('overview.paidVia'), classNames(th, "hidden md:table-cell"))}
                    {has("transfer") && head("transfer", t('transfers.fromTo'), classNames(th, "hidden md:table-cell"))}
                    {has("transferType") && head("transferType", t('transferType.label'), classNames(th, "hidden sm:table-cell"))}
                    {has("split") && head("split", t('overview.split'), classNames(th, "hidden md:table-cell"))}
                    {has("person") && head("person", t('overview.pot'), classNames(th, "hidden lg:table-cell"))}
                    {has("goal") && head("goal", t('goals.goal'), classNames(th, "hidden lg:table-cell"))}
                    {has("category") && head("category", t('entry.category'), classNames(th, "hidden sm:table-cell"))}
                    <th className={classNames(th, "w-10 pr-5")}/>
                </tr>
                </thead>
                <tbody>
                {sorted.map((c) => {
                    const goal = data.goals.find((g) => g.id === c.goal_id);
                    return (
                        <tr key={c.id} className={tr}>
                            {/* w-full + max-w-0: the name takes the remaining width and truncates instead of widening the table */}
                            <td className={classNames(td, "pl-5 w-full max-w-0")}>
                                <button onClick={() => navigate(`/contracts/${c.id}`)}
                                        className="flex w-full items-center gap-3 min-w-0 text-left hover:cursor-pointer">
                                    {c.kind === EntryKindTransfer && !c.icon_source ? (
                                        <IconTile icon={goal && goalStyle(goal).icon} iconComponent={goal ? undefined : ArrowsRightLeftIcon}
                                                  color={goal && goalStyle(goal).color} className="size-8"/>
                                    ) : (
                                        <EntryIcon name={c.name} icon={c.icon_source} category={categoryOf(c)} className="size-8"/>
                                    )}
                                    <span className="truncate font-medium text-zinc-950 dark:text-white">{c.name}</span>
                                    {c.owner_id != null && (
                                        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{t('entries.personal')}</span>
                                    )}
                                </button>
                            </td>
                            <td className={classNames(td, "text-right tabular-nums whitespace-nowrap font-medium",
                                amountTone === "income" ? "text-green-700 dark:text-green-400" : "text-zinc-950 dark:text-white")}>
                                {perMonth && c.billing_period !== BillingPeriodMonthly ? (
                                    <Tooltip text={`${format(c.costs ?? 0, c.currency)} ${lowerFirst(entryIntervalLabel(c))}`}>
                                        <span className="cursor-help underline decoration-dotted decoration-zinc-400 underline-offset-4">
                                            {format(amountOf(c), c.currency)}
                                        </span>
                                    </Tooltip>
                                ) : format(amountOf(c), c.currency)}
                            </td>
                            {has("interval") && <td className={classNames(td, "hidden md:table-cell whitespace-nowrap")}>{entryIntervalLabel(c)}</td>}
                            {has("earner") && (
                                <td className={classNames(td, "hidden sm:table-cell whitespace-nowrap")}>
                                    {(() => {
                                        const earner = costOwner(c, data.persons, data.accounts);
                                        return earner === "household" ? t('income.earnerShared') : data.persons.find((p) => p.id === earner)?.name;
                                    })()}
                                </td>
                            )}
                            {has("account") && (
                                <td className={classNames(td, "hidden md:table-cell whitespace-nowrap")}>{accountName(c.account_id, data.accounts) ?? "–"}</td>
                            )}
                            {has("transfer") && (
                                <td className={classNames(td, "hidden md:table-cell min-w-64")}>
                                    <span className="inline-flex flex-wrap items-center gap-x-1.5">
                                        {accountName(c.account_id, data.accounts) ?? "–"}
                                        <ArrowRightIcon className="size-3 text-zinc-400"/>
                                        {accountName(c.target_account_id, data.accounts) ?? "–"}
                                    </span>
                                </td>
                            )}
                            {has("transferType") && (
                                <td className={classNames(td, "hidden sm:table-cell")}>
                                    {(() => {
                                        const type = transferTypeOf(c, accountById);
                                        return (
                                            <Badge color={type === TransferTypeSaving ? "green" : type === TransferTypeWithdrawal ? "amber" : "zinc"}>
                                                {transferTypeLabel(c)}
                                            </Badge>
                                        );
                                    })()}
                                </td>
                            )}
                            {has("split") && (
                                <td className={classNames(td, "hidden md:table-cell whitespace-nowrap")}>
                                    {splitText(c, data.persons, data.accounts, t('common.household'), i18n.language)}
                                </td>
                            )}
                            {has("person") && (
                                <td className={classNames(td, "hidden lg:table-cell")}>
                                    {potLabel(potOf(data.accounts.find((a) => a.id === c.account_id)))}
                                </td>
                            )}
                            {has("goal") && (
                                <td className={classNames(td, "hidden lg:table-cell")}>
                                    {goal ? (
                                        <span className="inline-flex items-center gap-2">
                                            <IconTile {...goalStyle(goal)} className="size-6"/>{goal.name}
                                        </span>
                                    ) : "–"}
                                </td>
                            )}
                            {has("category") && <td className={classNames(td, "hidden sm:table-cell")}><CategoryBadge categoryId={c.category_id} fallbackName={c.category} categories={data.categories}/></td>}
                            <td className={classNames(td, "pr-5 text-right")}>
                                <RowActions
                                    onEdit={() => navigate(`/contracts/${c.id}/edit`)}
                                    onDelete={async () => {
                                        await sendJson("DELETE", `/contracts/${c.id}`);
                                        revalidator.revalidate();
                                    }}
                                    deleteMessage={t('entryForm.deleteEntryMessage')}
                                />
                            </td>
                        </tr>
                    );
                })}
                {sorted.length === 0 && (
                    <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                        {isFiltered && entries.length > 0 ? t('table.noMatches') : emptyText}
                    </td></tr>
                )}
                </tbody>
            </table>
        </div>
        </>
    );
}
