import {useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {PlusIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import RowActions from "../components/ui/RowActions.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import CategoryDialog from "../components/dialogs/CategoryDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {EntryKindExpense, EntryKindIncome, type CategoryDto} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {amountInMonth} from "../utils/budget.utils.ts";
import {categoryLabel} from "../utils/household.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {slotColor} from "../lib/icons.ts";
import {sendJson} from "../lib/api.ts";
import {card, table, td, th, tr} from "../utils/ui.ts";

export default function CategoriesPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {month, mode} = useMonth();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [type, setType] = useState<string>(EntryKindExpense);
    const [editing, setEditing] = useState<CategoryDto | null | undefined>(undefined);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const entriesOf = (cat: CategoryDto) => data.contracts.filter((c) =>
        c.category.toLowerCase() === cat.name.toLowerCase() && c.kind === cat.type);
    const listed = data.categories.filter((c) => c.type === type);

    return (
        <div className="flex flex-col gap-6">
            <CategoryDialog open={editing !== undefined} category={editing ?? undefined} defaultType={type}
                            count={data.categories.length} onClose={() => setEditing(undefined)}/>
            <PageHeader title={t('categories.title')} subtitle={t('categories.subtitle')}
                        actions={<Button onClick={() => setEditing(null)} className="hover:cursor-pointer"><PlusIcon/>{t('categories.add')}</Button>}/>
            <div className={card}>
                <div className="mb-3">
                    <SegmentedControl value={type} onChange={setType} options={[
                        {value: EntryKindExpense, label: t('categories.expenses')},
                        {value: EntryKindIncome, label: t('categories.income')},
                    ]}/>
                </div>
                <div className="overflow-x-auto -mx-5">
                    <table className={table}>
                        <thead>
                        <tr>
                            <th className={classNames(th, "pl-5")}>{t('common.name')}</th>
                            <th className={classNames(th, "hidden sm:table-cell")}>{t('categories.color')}</th>
                            <th className={classNames(th, "text-right")}>{t('categories.entries')}</th>
                            <th className={classNames(th, "text-right")}>{t('categories.sumIn', {month: month.format("MMM")})}</th>
                            <th className={classNames(th, "w-10 pr-5")}/>
                        </tr>
                        </thead>
                        <tbody>
                        {listed.map((cat) => {
                            const entries = entriesOf(cat);
                            const sum = entries.reduce((s, c) => s + amountInMonth(c, month, mode) * (c.kind === EntryKindExpense ? c.household_share : 1), 0);
                            return (
                                <tr key={cat.id} className={tr}>
                                    <td className={classNames(td, "pl-5")}>
                                        <button onClick={() => setEditing(cat)} className="flex items-center gap-3 text-left hover:cursor-pointer">
                                            <IconTile icon={cat.icon} color={cat.color} className="size-8"/>
                                            <span className="font-medium text-zinc-950 dark:text-white">{categoryLabel(cat.name, cat.key)}</span>
                                        </button>
                                    </td>
                                    <td className={classNames(td, "hidden sm:table-cell")}>
                                        <span className="block size-3 rounded-full" style={{background: slotColor(cat.color)}}/>
                                    </td>
                                    <td className={classNames(td, "text-right tabular-nums")}>{entries.length}</td>
                                    <td className={classNames(td, "text-right tabular-nums font-medium text-zinc-950 dark:text-white")}>
                                        {sum > 0 ? format(sum) : "–"}
                                    </td>
                                    <td className={classNames(td, "pr-5 text-right")}>
                                        <RowActions onEdit={() => setEditing(cat)}
                                                    deleteMessage={entries.length > 0 ? t('categories.deleteInUse', {count: entries.length}) : undefined}
                                                    onDelete={async () => {
                                                        await sendJson("DELETE", `/categories/${cat.id}`);
                                                        revalidator.revalidate();
                                                    }}/>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
