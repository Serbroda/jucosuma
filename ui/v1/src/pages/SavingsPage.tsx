import {useMemo, useState} from "react";
import {NavLink, useLoaderData, useRevalidator} from "react-router";
import {Trans, useTranslation} from "react-i18next";
import {Heading} from "../components/catalyst/heading.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import SegmentedControl from "../components/SegmentedControl.tsx";
import type {AccountDto, ContractDto, PersonDto} from "../gen/types.gen.ts";
import {type SavingsAccount, summarizeSavings} from "../utils/budget.utils.ts";
import {accountOwnerLabel, accountTypeLabel} from "../utils/household.utils.ts";
import {formatDecimal, numberLocale, parseAmount} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {saveAccount} from "../lib/accounts.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import dayjs from "../lib/dayjs";

import {card, statLabel, statValue} from "../utils/ui.ts";

function SavingsCard({item, persons, currency, onSave}: {
    item: SavingsAccount;
    persons: PersonDto[];
    currency: string;
    onSave: (account: AccountDto) => Promise<void>;
}) {
    const {t} = useTranslation();
    const {account} = item;
    const money = (value: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency}).format(value);

    const saveBalance = (raw: string) => {
        const balance = parseAmount(raw);
        if (balance === account.balance) return;
        onSave({...account, balance, balance_date: dayjs().format("YYYY-MM-DD")});
    };

    return (
        <div className={card}>
            <div className="flex items-baseline gap-2">
                <span className="font-semibold text-zinc-950 dark:text-white truncate">{account.name}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                    {accountTypeLabel(account.type)} · {accountOwnerLabel(account, persons)}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
                <Field>
                    <Label>{t('savings.balance')}</Label>
                    <Input
                        inputMode="decimal"
                        defaultValue={formatDecimal(account.balance)}
                        placeholder="0,00"
                        className="text-right"
                        onBlur={(e) => saveBalance(e.target.value)}
                    />
                </Field>
                <div className="flex flex-col justify-end pb-2">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('savings.monthlyRate')}</div>
                    <div className={classNames("text-sm tabular-nums font-medium",
                        item.monthlyRate < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-950 dark:text-white")}>
                        {money(item.monthlyRate)}
                    </div>
                </div>
            </div>
            {account.balance_date && (
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    {t('savings.asOf', {date: dayjs(account.balance_date).format("DD.MM.YYYY")})}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
                <Field>
                    <Label>{t('savings.goal')}</Label>
                    <Input
                        inputMode="decimal"
                        defaultValue={formatDecimal(account.goal_amount)}
                        placeholder={t('savings.optional')}
                        className="text-right"
                        onBlur={(e) => {
                            const goal = parseAmount(e.target.value);
                            if (goal !== account.goal_amount) onSave({...account, goal_amount: goal});
                        }}
                    />
                </Field>
                <Field>
                    <Label>{t('savings.goalDate')}</Label>
                    <Input
                        type="date"
                        defaultValue={account.goal_date ? dayjs(account.goal_date).format("YYYY-MM-DD") : ""}
                        onBlur={(e) => {
                            const goalDate = e.target.value || undefined;
                            if (goalDate !== (account.goal_date ? dayjs(account.goal_date).format("YYYY-MM-DD") : undefined)) {
                                onSave({...account, goal_date: goalDate});
                            }
                        }}
                    />
                </Field>
            </div>

            {item.progress != null && (
                <div className="mt-4">
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-green-600 dark:bg-green-500"
                             style={{width: `${item.progress * 100}%`}}/>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex flex-col gap-0.5">
                        <span>{t('savings.progress', {
                            percent: Math.round(item.progress * 100),
                            amount: money(account.goal_amount ?? 0),
                        })}</span>
                        {item.monthsToGoal === 0 && <span className="text-green-700 dark:text-green-400">{t('savings.reached')}</span>}
                        {item.goalReachedOn && (
                            <span>{t('savings.reachedOn', {date: item.goalReachedOn.format("MMMM YYYY")})}</span>
                        )}
                        {item.monthsToGoal == null && item.monthlyRate <= 0 && <span>{t('savings.noRate')}</span>}
                        {item.requiredRate != null && (
                            <span className={item.requiredRate > item.monthlyRate ? "text-amber-600 dark:text-amber-400" : ""}>
                                {t('savings.required', {
                                    amount: money(item.requiredRate),
                                    date: dayjs(account.goal_date).format("MMMM YYYY"),
                                })}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SavingsPage() {
    const {contracts, persons, accounts} = useLoaderData() as {
        contracts: ContractDto[];
        persons: PersonDto[];
        accounts: AccountDto[];
    };
    const {t} = useTranslation();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [owner, setOwner] = useState("all");

    const all = useMemo(() => summarizeSavings(contracts, accounts), [contracts, accounts]);
    const items = all.filter((s) =>
        owner === "all" || (owner === "shared" ? s.account.person_id == null : String(s.account.person_id) === owner));

    const total = items.reduce((sum, s) => sum + s.balance, 0);
    const rate = items.reduce((sum, s) => sum + s.monthlyRate, 0);
    const money = (value: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(value);

    const onSave = async (account: AccountDto) => {
        await saveAccount(account);
        revalidator.revalidate();
    };

    const owners = [
        {value: "all", label: t('savings.all')},
        {value: "shared", label: t('common.shared')},
        ...persons.filter((p) => p.in_household).map((p) => ({value: String(p.id), label: p.name})),
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
                <Heading>{t('savings.title')}</Heading>
                {all.length > 0 && (
                    <div className="sm:ml-auto">
                        <SegmentedControl value={owner} onChange={setOwner} options={owners}/>
                    </div>
                )}
            </div>

            {all.length === 0 ? (
                <div className={classNames(card, "bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-500 dark:text-zinc-400")}>
                    <Trans i18nKey="savings.empty" components={{link: <NavLink to="/household" className="underline"/>}}/>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className={card}>
                            <div className={statLabel}>{t('savings.total')}</div>
                            <div className={statValue}>{money(total)}</div>
                        </div>
                        <div className={card}>
                            <div className={statLabel}>{t('savings.monthlyRate')}</div>
                            <div className={statValue}>{money(rate)}</div>
                        </div>
                        <div className={classNames(card, "col-span-2 lg:col-span-1")}>
                            <div className={statLabel}>{t('savings.inOneYear')}</div>
                            <div className={statValue}>{money(total + rate * 12)}</div>
                            <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{t('savings.inOneYearHint')}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {items.map((item) => (
                            <SavingsCard key={item.account.id} item={item} persons={persons} currency={mainCurrency} onSave={onSave}/>
                        ))}
                    </div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{t('savings.rateHint')}</p>
                </>
            )}
        </div>
    );
}
