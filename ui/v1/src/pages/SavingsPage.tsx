import {useMemo, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {ArrowPathIcon, PlusIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import IconTile from "../components/ui/IconTile.tsx";
import RowActions from "../components/ui/RowActions.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import EntryTable from "../components/EntryTable.tsx";
import GoalDialog from "../components/dialogs/GoalDialog.tsx";
import QuickEntryDialog from "../components/QuickEntryDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {EntryKindTransfer, GoalKindInvesting, GoalKindSaving, type SavingsGoalDto} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {summarizeGoals} from "../utils/budget.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {slotColor} from "../lib/icons.ts";
import {sendJson} from "../lib/api.ts";
import {card, cardTitle} from "../utils/ui.ts";
import dayjs from "../lib/dayjs";

type Filter = "all" | "saving" | "investing" | "shared" | "personal";

export default function SavingsPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [filter, setFilter] = useState<Filter>("all");
    const [editing, setEditing] = useState<SavingsGoalDto | null | undefined>(undefined);
    // goal for which a monthly payment (transfer) is being created
    const [paymentFor, setPaymentFor] = useState<SavingsGoalDto | undefined>();

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency, maximumFractionDigits: 0}).format(v);
    const all = useMemo(() => summarizeGoals(data.contracts, data.goals), [data.contracts, data.goals]);
    const goals = all.filter(({goal}) => {
        switch (filter) {
            case "saving": return goal.kind === GoalKindSaving;
            case "investing": return goal.kind === GoalKindInvesting;
            case "shared": return goal.person_id == null;
            case "personal": return goal.person_id != null;
            default: return true;
        }
    });
    const totalSaved = all.reduce((s, g) => s + g.current, 0);
    const totalRate = all.reduce((s, g) => s + g.monthlyRate, 0);
    const goalTransfers = all.flatMap((g) => g.transfers);
    const ownerName = (g: SavingsGoalDto) =>
        g.person_id == null ? t('common.shared') : data.persons.find((p) => p.id === g.person_id)?.name ?? t('common.unknown');

    return (
        <div className="flex flex-col gap-6">
            <GoalDialog open={editing !== undefined} goal={editing ?? undefined} onClose={() => setEditing(undefined)}
                        persons={data.persons} accounts={data.accounts} count={data.goals.length}
                        payments={all.find((g) => g.goal.id === editing?.id)?.transfers}
                        monthlyRate={all.find((g) => g.goal.id === editing?.id)?.monthlyRate}
                        onAddPayment={() => {
                            const goal = editing ?? undefined;
                            setEditing(undefined);
                            setPaymentFor(goal);
                        }}/>
            <QuickEntryDialog isOpen={paymentFor != null} initialKind={EntryKindTransfer} onClose={() => setPaymentFor(undefined)}
                              persons={data.persons} accounts={data.accounts} categories={data.categories} goals={data.goals}
                              prefill={paymentFor && {
                                  name: paymentFor.name, goalId: paymentFor.id, targetAccountId: paymentFor.account_id ?? undefined,
                              }}/>
            <PageHeader title={t('goals.title')} subtitle={t('goals.subtitle')}
                        actions={<Button onClick={() => setEditing(null)} className="hover:cursor-pointer"><PlusIcon/>{t('goals.add')}</Button>}/>

            {all.length > 0 && (
                <div className="flex flex-wrap items-center gap-6">
                    <div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('goals.totalSaved')}</div>
                        <div className="text-2xl font-semibold text-zinc-950 dark:text-white">{format(totalSaved)}</div>
                    </div>
                    <div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('savings.monthlyRate')}</div>
                        <div className="text-2xl font-semibold text-zinc-950 dark:text-white">{format(totalRate)}</div>
                    </div>
                    <div className="sm:ml-auto">
                        <SegmentedControl value={filter} onChange={setFilter} options={[
                            {value: "all", label: t('goals.allGoals')},
                            {value: "saving", label: t('goals.saving')},
                            {value: "investing", label: t('goals.investing')},
                            {value: "shared", label: t('common.shared')},
                            {value: "personal", label: t('goals.personal')},
                        ]}/>
                    </div>
                </div>
            )}

            {all.length === 0 ? (
                <div className={card + " text-center py-12"}>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{t('goals.empty')}</div>
                    <Button className="mt-4 hover:cursor-pointer" onClick={() => setEditing(null)}><PlusIcon/>{t('goals.add')}</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {goals.map(({goal, current, monthlyRate, progress, reachedOn, requiredRate}) => (
                        <div key={goal.id} className={card + " flex flex-col gap-3"}>
                            <div className="flex items-start gap-3">
                                <IconTile icon={goal.icon} color={goal.color} className="size-11"/>
                                <div className="grow min-w-0">
                                    <button onClick={() => setEditing(goal)}
                                            className="font-semibold text-zinc-950 dark:text-white truncate block text-left hover:underline hover:cursor-pointer">
                                        {goal.name}
                                    </button>
                                    <div className="text-xs text-zinc-400 dark:text-zinc-500">
                                        {goal.kind === GoalKindInvesting ? t('goals.investing') : t('goals.saving')} · {ownerName(goal)}
                                    </div>
                                </div>
                                <RowActions
                                    onEdit={() => setEditing(goal)}
                                    onDelete={async () => {
                                        await sendJson("DELETE", `/savings_goals/${goal.id}`);
                                        revalidator.revalidate();
                                    }}
                                />
                            </div>
                            <div className="flex items-baseline gap-1 text-sm">
                                <span className="font-semibold text-zinc-950 dark:text-white">{format(current)}</span>
                                {goal.target_amount != null && (
                                    <span className="text-zinc-400 dark:text-zinc-500">{t('goals.of', {amount: format(goal.target_amount)})}</span>
                                )}
                                {progress != null && (
                                    <span className="ml-auto text-sm font-medium text-zinc-600 dark:text-zinc-300">{Math.round(progress * 100)} %</span>
                                )}
                            </div>
                            {progress != null && (
                                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                    <div className="h-full rounded-full" style={{width: `${progress * 100}%`, background: slotColor(goal.color)}}/>
                                </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-auto">
                                {monthlyRate > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                                        <ArrowPathIcon className="size-3"/>{t('goals.perMonth', {amount: format(monthlyRate)})}
                                    </span>
                                ) : (
                                    <button type="button" onClick={() => setPaymentFor(goal)}
                                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 dark:border-zinc-600 px-2 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:cursor-pointer">
                                        <PlusIcon className="size-3"/>{t('goals.addPayment')}
                                    </button>
                                )}
                                {progress === 1 && <span>{t('savings.reached')}</span>}
                                {progress !== 1 && reachedOn && <span>{t('goals.reachedOn', {date: reachedOn.format("MMM YYYY")})}</span>}
                                {requiredRate != null && requiredRate > monthlyRate + 0.5 && (
                                    <span className="text-amber-700 dark:text-amber-400">
                                        {t('goals.required', {amount: format(requiredRate), date: dayjs(goal.target_date).format("MMM YYYY")})}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {goalTransfers.length > 0 && (
                <div className={card}>
                    <div className={cardTitle + " mb-3"}>{t('goals.plannedPayments')}</div>
                    <EntryTable entries={goalTransfers} data={data} columns={["interval", "transfer", "goal"]} emptyText=""/>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">{t('goals.estimateHint')}</p>
                </div>
            )}
        </div>
    );
}
