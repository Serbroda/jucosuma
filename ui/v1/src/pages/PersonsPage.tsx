import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import {PlusIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import RowActions from "../components/ui/RowActions.tsx";
import PersonDialog from "../components/dialogs/PersonDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Avatar} from "../components/catalyst/avatar.tsx";
import {Badge} from "../components/catalyst/badge.tsx";
import type {PersonDto, UserOptionDto} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useMonth} from "../stores/useMonth.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {summarizeMonth} from "../utils/budget.utils.ts";
import {personSlot} from "../utils/household.utils.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {slotColor} from "../lib/icons.ts";
import {sendJson} from "../lib/api.ts";
import {apiFetch} from "../lib/fetch.ts";
import {apiBasePath} from "../config.ts";
import {card, table, td, th, tr} from "../utils/ui.ts";
import {useAuth} from "../stores/useAuth.ts";
import UsersPage from "./UsersPage.tsx";

export default function PersonsPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {month, mode} = useMonth();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [editing, setEditing] = useState<PersonDto | null | undefined>(undefined);
    const [logins, setLogins] = useState<UserOptionDto[]>([]);
    const isAdmin = useAuth().user?.role === 'admin';

    useEffect(() => {
        apiFetch(`${apiBasePath}/user_options`).then(async (res) => res.ok && setLogins(await res.json()));
    }, []);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency}).format(v);
    const summary = summarizeMonth(data.contracts, data.persons, data.accounts, month, mode, mainCurrency);
    const shareOf = (p: PersonDto) => summary.privateCosts[p.id] ?? 0;
    const entriesOf = (p: PersonDto) => data.contracts.filter((c) => c.shares.some((s) => s.person_id === p.id)).length;
    const initials = (name: string) => name.trim().slice(0, 2);

    return (
        <div className="flex flex-col gap-6">
            <PersonDialog open={editing !== undefined} person={editing ?? undefined} persons={data.persons}
                          onClose={() => setEditing(undefined)}/>
            <PageHeader title={t('persons.title')} subtitle={t('persons.subtitle')}
                        actions={<Button onClick={() => setEditing(null)} className="hover:cursor-pointer"><PlusIcon/>{t('persons.add')}</Button>}/>
            <div className={card}>
                <div className="overflow-x-auto -mx-5">
                    <table className={table}>
                        <thead>
                        <tr>
                            <th className={classNames(th, "pl-5")}>{t('common.name')}</th>
                            <th className={th}>{t('household.membership')}</th>
                            <th className={classNames(th, "hidden sm:table-cell")}>{t('household.login')}</th>
                            <th className={classNames(th, "text-right hidden md:table-cell")}>{t('persons.entries')}</th>
                            <th className={classNames(th, "text-right")}>{t('persons.costsIn', {month: month.format("MMM")})}</th>
                            <th className={classNames(th, "w-10 pr-5")}/>
                        </tr>
                        </thead>
                        <tbody>
                        {data.persons.map((p) => {
                            const slot = p.in_household ? personSlot(data.persons, p.id) : undefined;
                            return (
                                <tr key={p.id} className={tr}>
                                    <td className={classNames(td, "pl-5")}>
                                        <button onClick={() => setEditing(p)} className="flex items-center gap-3 text-left hover:cursor-pointer">
                                            <Avatar initials={initials(p.name)} className="size-8 text-white"
                                                    style={{background: slotColor(slot)}}/>
                                            <span className="font-medium text-zinc-950 dark:text-white">{p.name}</span>
                                        </button>
                                    </td>
                                    <td className={td}>
                                        <Badge color={p.in_household ? "blue" : "zinc"}>
                                            {p.in_household ? t('household.member') : t('household.external')}
                                        </Badge>
                                    </td>
                                    <td className={classNames(td, "hidden sm:table-cell")}>
                                        {logins.find((l) => l.id === p.user_id)?.username ?? "–"}
                                    </td>
                                    <td className={classNames(td, "text-right tabular-nums hidden md:table-cell")}>{entriesOf(p)}</td>
                                    <td className={classNames(td, "text-right tabular-nums font-medium text-zinc-950 dark:text-white")}>
                                        {p.in_household ? format(shareOf(p)) : "–"}
                                    </td>
                                    <td className={classNames(td, "pr-5 text-right")}>
                                        <RowActions onEdit={() => setEditing(p)} onDelete={async () => {
                                            await sendJson("DELETE", `/persons/${p.id}`);
                                            revalidator.revalidate();
                                        }}/>
                                    </td>
                                </tr>
                            );
                        })}
                        {data.persons.length === 0 && (
                            <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">{t('persons.empty')}</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
            {isAdmin && <UsersPage/>}
        </div>
    );
}