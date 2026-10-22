import {useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {ArrowTrendingUpIcon, PencilIcon, TrashIcon} from "@heroicons/react/16/solid";
import {Subheading} from "./catalyst/heading.tsx";
import {Divider} from "./catalyst/divider.tsx";
import {Button} from "./catalyst/button.tsx";
import {Badge} from "./catalyst/badge.tsx";
import AmountChangeDialog, {type AmountStep} from "./dialogs/AmountChangeDialog.tsx";
import type {ContractDto} from "../gen/types.gen.ts";
import {formatCurrency} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {sendJson} from "../lib/api.ts";
import dayjs from "../lib/dayjs";
import type {Dayjs} from "dayjs";

/**
 * Amount over time of an entry: the start amount and every change, with a way to add one.
 * `compact` renders it as a small box inside the edit form instead of a page section.
 */
export default function AmountHistory({contract, compact}: { contract: ContractDto; compact?: boolean }) {
    const {t, i18n} = useTranslation();
    const revalidator = useRevalidator();
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<AmountStep | undefined>();

    const steps = [
        {id: undefined as number | undefined, from: dayjs(contract.start_date), costs: contract.base_costs ?? contract.costs ?? 0},
        ...(contract.amounts ?? []).map((a) => ({id: a.id as number | undefined, from: dayjs(a.valid_from), costs: a.costs})),
    ];
    const today = dayjs();
    const edit = (s: { id?: number; from: Dayjs; costs: number }) =>
        setEditing({id: s.id, validFrom: s.from.format("YYYY-MM-DD"), costs: s.costs});
    const currentIndex = steps.reduce((idx, s, i) => (!s.from.isAfter(today, "day") ? i : idx), 0);

    const content = (
        <>
            <AmountChangeDialog open={adding || editing != null} contract={contract} editing={editing}
                                onClose={() => {
                                    setAdding(false);
                                    setEditing(undefined);
                                }}/>
            {compact ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-950 dark:text-white">{t('amounts.title')}</span>
                    <Button outline type="button" onClick={() => setAdding(true)} className="hover:cursor-pointer">
                        <ArrowTrendingUpIcon/>{t('amounts.add')}
                    </Button>
                </div>
            ) : (
                <>
                    <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
                        <Subheading>{t('amounts.title')}</Subheading>
                        <Button outline onClick={() => setAdding(true)} className="hover:cursor-pointer">
                            <ArrowTrendingUpIcon/>{t('amounts.add')}
                        </Button>
                    </div>
                    <Divider className="mt-4"/>
                </>
            )}
            {steps.length === 1 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 py-3">{t('amounts.none', {amount: formatCurrency(steps[0].costs, contract.currency)})}</p>
            )}
            {steps.length > 1 && (
                <ul className="divide-y divide-zinc-950/5 dark:divide-white/5">
                    {steps.map((s, i) => {
                        const previous = i > 0 ? steps[i - 1].costs : undefined;
                        const change = previous ? (s.costs - previous) / previous : undefined;
                        return (
                            <li key={s.id ?? "start"} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                                <button type="button" onClick={() => edit(s)} title={t('amounts.edit')}
                                        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-left rounded-md -mx-1.5 px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:cursor-pointer">
                                <span className="w-36 text-zinc-500 dark:text-zinc-400">
                                    {i === 0 ? t('amounts.since', {date: s.from.format("DD.MM.YYYY")}) : t('amounts.from', {date: s.from.format("DD.MM.YYYY")})}
                                </span>
                                <span className="font-medium tabular-nums text-zinc-950 dark:text-white">{formatCurrency(s.costs, contract.currency)}</span>
                                {change != null && (
                                    <span className={classNames("tabular-nums text-xs", change > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                                        {change > 0 ? "+" : ""}{(Math.round(change * 1000) / 10).toLocaleString(i18n.language)} %
                                    </span>
                                )}
                                </button>
                                {i === currentIndex && <Badge color="green">{t('amounts.current')}</Badge>}
                                {i > currentIndex && <Badge color="blue">{t('amounts.upcoming')}</Badge>}
                                <button type="button" aria-label={t('amounts.edit')} onClick={() => edit(s)}
                                        className="ml-auto rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 hover:cursor-pointer dark:hover:bg-zinc-800 dark:hover:text-white">
                                    <PencilIcon className="size-4"/>
                                </button>
                                {s.id != null && (
                                    <button type="button" aria-label={t('common.delete')}
                                            onClick={async () => {
                                                await sendJson("DELETE", `/contracts/${contract.id}/amounts/${s.id}`);
                                                revalidator.revalidate();
                                            }}
                                            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 hover:cursor-pointer dark:hover:bg-zinc-800">
                                        <TrashIcon className="size-4"/>
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
    return compact
        ? <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3">{content}</div>
        : content;
}