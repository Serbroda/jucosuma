import {useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {BanknotesIcon, BuildingLibraryIcon, ChartBarIcon, PlusIcon, WalletIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import RowActions from "../components/ui/RowActions.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import AccountDialog from "../components/dialogs/AccountDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {
    AccountTypeCash,
    AccountTypeChecking,
    AccountTypeDepot,
    AccountTypeOther,
    AccountTypeSavings,
    type AccountDto,
} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {summarizeMonth} from "../utils/budget.utils.ts";
import {accountOwnerLabel, accountTypeLabel} from "../utils/household.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {sendJson} from "../lib/api.ts";
import type {IconComponent} from "../lib/icons.ts";
import {card, cardTitle, table, td, th, tr} from "../utils/ui.ts";
import dayjs from "../lib/dayjs";
import SortableTh from "../components/ui/SortableTh.tsx";
import {useSort} from "../utils/sort.utils.ts";

/** Icon and colour slot per account type. */
const typeStyle: Record<string, { icon: IconComponent; color: number }> = {
    [AccountTypeChecking]: {icon: BuildingLibraryIcon, color: 1},
    [AccountTypeSavings]: {icon: BanknotesIcon, color: 3},
    [AccountTypeDepot]: {icon: ChartBarIcon, color: 7},
    [AccountTypeCash]: {icon: WalletIcon, color: 4},
    [AccountTypeOther]: {icon: WalletIcon, color: 2},
};

export default function AccountsPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {month, mode} = useMonth();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [filter, setFilter] = useState("all");
    const [editing, setEditing] = useState<AccountDto | null | undefined>(undefined);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const summary = summarizeMonth(data.contracts, data.persons, data.accounts, month, mode, mainCurrency);
    const flow = new Map(summary.accounts.map((f) => [f.account.id, f.inflow - f.outflow]));

    const withBalance = data.accounts.filter((a) => a.balance != null);
    const totalAssets = withBalance.reduce((s, a) => s + (a.balance ?? 0), 0);
    const byType = Object.keys(typeStyle)
        .map((type) => ({type, sum: data.accounts.filter((a) => a.type === type).reduce((s, a) => s + (a.balance ?? 0), 0)}))
        .filter((x) => x.sum !== 0);
    const maxType = Math.max(...byType.map((x) => x.sum), 1);
    const listed = data.accounts.filter((a) => filter === "all" || a.type === filter);
    const {sorted, sort, toggle} = useSort(`accounts:${filter}`, listed, {
        name: (a) => a.name,
        type: (a) => accountTypeLabel(a.type),
        owner: (a) => accountOwnerLabel(a, data.persons),
        iban: (a) => a.iban?.slice(-4),
        flow: (a) => flow.get(a.id) ?? 0,
        balance: (a) => a.balance,
    });

    return (
        <div className="flex flex-col gap-6">
            <AccountDialog open={editing !== undefined} account={editing ?? undefined} onClose={() => setEditing(undefined)}
                           persons={data.persons}/>
            <PageHeader title={t('accounts.title')} subtitle={t('accounts.subtitle')}
                        actions={<Button onClick={() => setEditing(null)} className="hover:cursor-pointer"><PlusIcon/>{t('accounts.add')}</Button>}/>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={card}>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('accounts.totalAssets')}</div>
                    <div className="text-3xl font-semibold text-zinc-950 dark:text-white mt-1">{format(totalAssets)}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                        {t('accounts.assetsHint', {count: withBalance.length})}
                    </div>
                </div>
                <div className={card}>
                    <div className={cardTitle + " mb-3"}>{t('accounts.byType')}</div>
                    {byType.length === 0 && <div className="text-sm text-zinc-400 dark:text-zinc-500">{t('accounts.noBalances')}</div>}
                    <div className="flex flex-col gap-2.5">
                        {byType.map(({type, sum}) => (
                            <div key={type} className="flex items-center gap-3 text-sm">
                                <IconTile iconComponent={typeStyle[type].icon} color={typeStyle[type].color} className="size-6"/>
                                <span className="w-36 truncate text-zinc-700 dark:text-zinc-300">{accountTypeLabel(type)}</span>
                                <div className="grow h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                    <div className="h-full rounded-full" style={{width: `${Math.max(0, sum) / maxType * 100}%`, background: `var(--chart-${typeStyle[type].color})`}}/>
                                </div>
                                <span className="w-28 text-right tabular-nums text-zinc-950 dark:text-white">{format(sum)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className={card}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className={cardTitle}>{t('accounts.listTitle')}</div>
                    <SegmentedControl value={filter} onChange={setFilter} options={[
                        {value: "all", label: t('accounts.all')},
                        {value: AccountTypeChecking, label: t('accounts.checking')},
                        {value: AccountTypeSavings, label: t('accounts.savings')},
                        {value: AccountTypeDepot, label: t('accounts.depots')},
                    ]}/>
                </div>
                <div className="overflow-x-auto -mx-5">
                    <table className={table}>
                        <thead>
                        <tr>
                            <SortableTh sortKey="name" sort={sort} onSort={toggle} className={classNames(th, "pl-5")}>{t('common.name')}</SortableTh>
                            <SortableTh sortKey="type" sort={sort} onSort={toggle} className={classNames(th, "hidden md:table-cell")}>{t('household.accountType')}</SortableTh>
                            <SortableTh sortKey="owner" sort={sort} onSort={toggle} className={classNames(th, "hidden sm:table-cell")}>{t('household.owner')}</SortableTh>
                            <SortableTh sortKey="iban" sort={sort} onSort={toggle} className={classNames(th, "hidden lg:table-cell")}>{t('accounts.ibanShort')}</SortableTh>
                            <SortableTh sortKey="flow" sort={sort} onSort={toggle} className={classNames(th, "text-right hidden md:table-cell")} align="right">{t('accounts.monthly', {month: month.format("MMM")})}</SortableTh>
                            <SortableTh sortKey="balance" sort={sort} onSort={toggle} className={classNames(th, "text-right")} align="right">{t('accounts.currentBalance')}</SortableTh>
                            <th className={classNames(th, "w-10 pr-5")}/>
                        </tr>
                        </thead>
                        <tbody>
                        {sorted.map((a) => {
                            const style = typeStyle[a.type] ?? typeStyle[AccountTypeOther];
                            const net = flow.get(a.id) ?? 0;
                            return (
                                <tr key={a.id} className={tr}>
                                    <td className={classNames(td, "pl-5")}>
                                        <button onClick={() => setEditing(a)} className="flex items-center gap-3 text-left hover:cursor-pointer">
                                            <IconTile iconComponent={style.icon} color={style.color} className="size-8"/>
                                            <span className="font-medium text-zinc-950 dark:text-white">{a.name}</span>
                                            {a.is_savings && (
                                                <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                                    {t('household.isSavings')}
                                                </span>
                                            )}
                                        </button>
                                    </td>
                                    <td className={classNames(td, "hidden md:table-cell")}>{accountTypeLabel(a.type)}</td>
                                    <td className={classNames(td, "hidden sm:table-cell")}>{accountOwnerLabel(a, data.persons)}</td>
                                    <td className={classNames(td, "hidden lg:table-cell tabular-nums text-zinc-400 dark:text-zinc-500")}>
                                        {a.iban ? `•••• ${a.iban.slice(-4)}` : "–"}
                                    </td>
                                    <td className={classNames(td, "text-right tabular-nums hidden md:table-cell",
                                        net < 0 ? "text-red-600 dark:text-red-400" : "")}>
                                        {net === 0 ? "–" : `${net > 0 ? "+" : ""}${format(net)}`}
                                    </td>
                                    <td className={classNames(td, "text-right tabular-nums")}>
                                        {a.balance != null ? (
                                            <>
                                                <div className="font-semibold text-zinc-950 dark:text-white">{format(a.balance)}</div>
                                                {a.balance_date && (
                                                    <div className="text-xs text-zinc-400 dark:text-zinc-500">{dayjs(a.balance_date).format("DD.MM.YYYY")}</div>
                                                )}
                                            </>
                                        ) : "–"}
                                    </td>
                                    <td className={classNames(td, "pr-5 text-right")}>
                                        <RowActions onEdit={() => setEditing(a)} onDelete={async () => {
                                            await sendJson("DELETE", `/accounts/${a.id}`);
                                            revalidator.revalidate();
                                        }}/>
                                    </td>
                                </tr>
                            );
                        })}
                        {listed.length === 0 && (
                            <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">{t('accounts.empty')}</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
