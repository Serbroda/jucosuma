import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowsRightLeftIcon, BanknotesIcon, PlusIcon, WalletIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import EntryTable from "../components/EntryTable.tsx";
import QuickEntryDialog from "../components/QuickEntryDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {EntryKindTransfer} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {amountInMonth, summarizeMonth} from "../utils/budget.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {card, cardTitle} from "../utils/ui.ts";

export default function TransfersPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {month, mode} = useMonth();
    const {mainCurrency} = usePreferences();
    const [adding, setAdding] = useState(false);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency, maximumFractionDigits: 0}).format(v);
    const transfers = data.contracts.filter((c) => c.kind === EntryKindTransfer);
    const summary = summarizeMonth(data.contracts, data.persons, data.accounts, month, mode, mainCurrency);
    const total = transfers.reduce((s, c) => s + amountInMonth(c, month, mode), 0);
    const pocketMoney = summary.budgets.reduce((s, b) => s + b.budget, 0);
    const listed = transfers
        .filter((c) => amountInMonth(c, month, "average") > 0)
        .sort((a, b) => amountInMonth(b, month, "average") - amountInMonth(a, month, "average"));

    const kpis = [
        {label: t('transfers.total'), value: total, icon: ArrowsRightLeftIcon, color: 1},
        {label: t('overview.saving'), value: summary.savings, icon: BanknotesIcon, color: 6},
        {label: t('transfers.pocketMoney'), value: pocketMoney, icon: WalletIcon, color: 7},
    ];

    return (
        <div className="flex flex-col gap-6">
            <QuickEntryDialog isOpen={adding} initialKind={EntryKindTransfer} onClose={() => setAdding(false)}
                              persons={data.persons} accounts={data.accounts} categories={data.categories} goals={data.goals}/>
            <PageHeader title={t('transfers.title')} subtitle={t('transfers.subtitle')}
                        actions={<Button onClick={() => setAdding(true)} className="hover:cursor-pointer"><PlusIcon/>{t('transfers.add')}</Button>}/>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {kpis.map((k) => (
                    <div key={k.label} className={card + " flex items-center gap-4"}>
                        <IconTile iconComponent={k.icon} color={k.color} className="size-11"/>
                        <div>
                            <div className="text-sm text-zinc-500 dark:text-zinc-400">{k.label}</div>
                            <div className="text-2xl font-semibold text-zinc-950 dark:text-white">{format(k.value)}</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className={card}>
                <div className={cardTitle + " mb-3"}>{t('transfers.listTitle')}</div>
                <EntryTable entries={listed} data={data} columns={["interval", "transfer", "goal"]} emptyText={t('transfers.empty')}/>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">{t('transfers.hint')}</p>
            </div>
        </div>
    );
}
