import {useNavigate, useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {ArrowRightIcon} from "@heroicons/react/16/solid";
import {ArrowsRightLeftIcon} from "@heroicons/react/20/solid";
import EntryIcon from "./EntryIcon.tsx";
import CategoryBadge from "./ui/CategoryBadge.tsx";
import RowActions from "./ui/RowActions.tsx";
import IconTile from "./ui/IconTile.tsx";
import {EntryKindTransfer, type ContractDto} from "../gen/types.gen.ts";
import type {AppData} from "../hooks/useAppData.ts";
import {type Pot, potOf, splitText, costOwner} from "../utils/budget.utils.ts";
import {accountName, isDefaultAssignment} from "../utils/household.utils.ts";
import {billingPeriodLabel} from "../utils/data.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {table, td, th, tr} from "../utils/ui.ts";
import {sendJson} from "../lib/api.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {classNames} from "../utils/dom.utils.ts";

export type EntryColumn = "interval" | "earner" | "account" | "transfer" | "split" | "person" | "category" | "goal";

/** Table of entries with configurable columns and edit/delete actions. */
export default function EntryTable({entries, data, columns, emptyText, amountTone}: {
    entries: ContractDto[];
    data: AppData;
    columns: EntryColumn[];
    emptyText: string;
    amountTone?: "income";
}) {
    const {t, i18n} = useTranslation();
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const {mainCurrency} = usePreferences();
    const format = (v: number, currency?: string | null) =>
        new Intl.NumberFormat(numberLocale(), {style: "currency", currency: currency || mainCurrency}).format(v);
    const has = (c: EntryColumn) => columns.includes(c);
    const potLabel = (pot: Pot) => pot === "household"
        ? t('overview.potHousehold') : data.persons.find((p) => p.id === pot)?.name ?? t('common.unknown');
    const categoryOf = (c: ContractDto) => data.categories.find((cat) => cat.id === c.category_id);

    return (
        <div className="overflow-x-auto -mx-5">
            <table className={table}>
                <thead>
                <tr>
                    <th className={classNames(th, "pl-5")}>{t('common.name')}</th>
                    <th className={classNames(th, "text-right")}>{t('entry.amount')}</th>
                    {has("interval") && <th className={classNames(th, "hidden md:table-cell")}>{t('entry.interval')}</th>}
                    {has("earner") && <th className={classNames(th, "hidden sm:table-cell")}>{t('income.earner')}</th>}
                    {has("account") && <th className={classNames(th, "hidden md:table-cell")}>{t('overview.paidVia')}</th>}
                    {has("transfer") && <th className={classNames(th, "hidden md:table-cell")}>{t('transfers.fromTo')}</th>}
                    {has("split") && <th className={classNames(th, "hidden lg:table-cell")}>{t('overview.split')}</th>}
                    {has("person") && <th className={classNames(th, "hidden lg:table-cell")}>{t('overview.pot')}</th>}
                    {has("goal") && <th className={classNames(th, "hidden lg:table-cell")}>{t('goals.goal')}</th>}
                    {has("category") && <th className={classNames(th, "hidden sm:table-cell")}>{t('entry.category')}</th>}
                    <th className={classNames(th, "w-10 pr-5")}/>
                </tr>
                </thead>
                <tbody>
                {entries.map((c) => {
                    const goal = data.goals.find((g) => g.id === c.goal_id);
                    return (
                        <tr key={c.id} className={tr}>
                            {/* w-full + max-w-0: the name takes the remaining width and truncates instead of widening the table */}
                            <td className={classNames(td, "pl-5 w-full max-w-0")}>
                                <button onClick={() => navigate(`/contracts/${c.id}`)}
                                        className="flex w-full items-center gap-3 min-w-0 text-left hover:cursor-pointer">
                                    {c.kind === EntryKindTransfer && !c.icon_source ? (
                                        <IconTile icon={goal?.icon} iconComponent={goal ? undefined : ArrowsRightLeftIcon}
                                                  color={goal?.color} className="size-8"/>
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
                                {format(c.costs ?? 0, c.currency)}
                            </td>
                            {has("interval") && <td className={classNames(td, "hidden md:table-cell whitespace-nowrap")}>{billingPeriodLabel(c.billing_period)}</td>}
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
                                <td className={classNames(td, "hidden md:table-cell whitespace-nowrap")}>
                                    <span className="inline-flex items-center gap-1.5">
                                        {accountName(c.account_id, data.accounts) ?? "–"}
                                        <ArrowRightIcon className="size-3 text-zinc-400"/>
                                        {accountName(c.target_account_id, data.accounts) ?? "–"}
                                    </span>
                                </td>
                            )}
                            {has("split") && (
                                <td className={classNames(td, "hidden lg:table-cell whitespace-nowrap")}>
                                    {/* only deviations from the account (e.g. a private cost on the joint account, external persons) */}
                                    {isDefaultAssignment(c, data.persons, data.accounts) ? ""
                                        : splitText(c, data.persons, data.accounts, t('common.household'), i18n.language)}
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
                                            <IconTile icon={goal.icon} color={goal.color} className="size-6"/>{goal.name}
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
                {entries.length === 0 && (
                    <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">{emptyText}</td></tr>
                )}
                </tbody>
            </table>
        </div>
    );
}
