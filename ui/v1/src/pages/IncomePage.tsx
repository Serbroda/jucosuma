import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {PlusIcon, UserIcon, UserGroupIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import EntryTable from "../components/EntryTable.tsx";
import StackedBars from "../components/charts/StackedBars.tsx";
import QuickEntryDialog from "../components/QuickEntryDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {BillingPeriodOneTime, EntryKindIncome} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {amountInMonth, potOf} from "../utils/budget.utils.ts";
import {personSlot} from "../utils/household.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {slotColor} from "../lib/icons.ts";
import {card, cardTitle} from "../utils/ui.ts";

export default function IncomePage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {month, mode} = useMonth();
    const {mainCurrency} = usePreferences();
    const [tab, setTab] = useState<"recurring" | "once">("recurring");
    const [adding, setAdding] = useState(false);

    const format = (v: number, digits = 0) => new Intl.NumberFormat(numberLocale(), {
        style: "currency", currency: mainCurrency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(v);

    const household = data.persons.filter((p) => p.in_household);
    const incomes = data.contracts.filter((c) => c.kind === EntryKindIncome && (!c.currency || c.currency === mainCurrency));

    /** Income of a month per pot: person id for private accounts, "household" for shared ones. */
    const byPot = (m: typeof month) => {
        const result: Record<string, number> = {};
        for (const c of incomes) {
            const amount = amountInMonth(c, m, mode);
            if (!amount) continue;
            const pot = String(potOf(data.accounts.find((a) => a.id === c.account_id)));
            result[pot] = (result[pot] ?? 0) + amount;
        }
        return result;
    };

    const current = useMemo(() => byPot(month), // eslint-disable-next-line react-hooks/exhaustive-deps
        [data, month.format("YYYY-MM")]);
    const total = Object.values(current).reduce((s, v) => s + v, 0);

    const series = [
        ...household.map((p) => ({key: String(p.id), label: p.name, color: slotColor(personSlot(data.persons, p.id))})),
        {key: "household", label: t('overview.potHousehold'), color: "var(--chart-other)"},
    ];
    const columns = Array.from({length: 6}, (_, i) => {
        const m = month.subtract(5 - i, "month");
        return {key: m.format("YYYY-MM"), label: m.format("MMM"), values: byPot(m), highlight: i === 5};
    });

    const listed = incomes
        .filter((c) => tab === "once" ? c.billing_period === BillingPeriodOneTime : c.billing_period !== BillingPeriodOneTime)
        .filter((c) => tab === "once" || amountInMonth(c, month, "average") > 0 || c.status !== "expired")
        .sort((a, b) => (b.monthly_amount ?? b.costs ?? 0) - (a.monthly_amount ?? a.costs ?? 0));

    return (
        <div className="flex flex-col gap-6">
            <QuickEntryDialog isOpen={adding} initialKind={EntryKindIncome} onClose={() => setAdding(false)}
                              persons={data.persons} accounts={data.accounts} categories={data.categories} goals={data.goals}/>
            <PageHeader title={t('income.title')} subtitle={t('income.subtitle')}
                        actions={<Button onClick={() => setAdding(true)} className="hover:cursor-pointer"><PlusIcon/>{t('income.add')}</Button>}/>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className={card}>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('income.total')}</div>
                    <div className="text-3xl font-semibold text-zinc-950 dark:text-white mt-1">{format(total)}</div>
                    <div className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">{month.format("MMMM YYYY")}</div>
                </div>
                {household.map((p) => {
                    const amount = current[String(p.id)] ?? 0;
                    return (
                        <div key={p.id} className={card + " flex items-center gap-4"}>
                            <IconTile iconComponent={UserIcon} color={personSlot(data.persons, p.id)} className="size-12"/>
                            <div>
                                <div className="text-sm text-zinc-500 dark:text-zinc-400">{p.name}</div>
                                <div className="text-2xl font-semibold text-zinc-950 dark:text-white">{format(amount)}</div>
                                <div className="text-xs text-zinc-400 dark:text-zinc-500">{total > 0 ? Math.round(amount / total * 100) : 0} %</div>
                            </div>
                        </div>
                    );
                })}
                {(current.household ?? 0) > 0 && (
                    <div className={card + " flex items-center gap-4"}>
                        <IconTile iconComponent={UserGroupIcon} className="size-12"/>
                        <div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('overview.potHousehold')}</div>
                            <div className="text-2xl font-semibold text-zinc-950 dark:text-white">{format(current.household)}</div>
                        </div>
                    </div>
                )}
            </div>

            <div className={card}>
                <div className={cardTitle + " mb-2"}>{t('income.lastSixMonths')}</div>
                <StackedBars series={series.filter((s) => columns.some((c) => (c.values[s.key] ?? 0) > 0))}
                             columns={columns} format={(v) => format(v, 2)}/>
            </div>

            <div className={card}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className={cardTitle}>{tab === "once" ? t('income.once') : t('income.recurring')}</div>
                    <SegmentedControl value={tab} onChange={setTab} options={[
                        {value: "recurring", label: t('income.tabRecurring')},
                        {value: "once", label: t('income.tabOnce')},
                    ]}/>
                </div>
                <EntryTable entries={listed} data={data} columns={["interval", "account", "person", "category"]}
                            emptyText={t('income.empty')} amountTone="income"/>
            </div>
        </div>
    );
}
