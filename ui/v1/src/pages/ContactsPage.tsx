import {Fragment, useEffect, useState} from "react";
import {NavLink, useRevalidator, useSearchParams} from "react-router";
import {useTranslation} from "react-i18next";
import {ChevronRightIcon, PlusIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import RowActions from "../components/ui/RowActions.tsx";
import TableToolbar from "../components/ui/TableToolbar.tsx";
import EntryIcon from "../components/EntryIcon.tsx";
import ContactDialog from "../components/dialogs/ContactDialog.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {EntryKindExpense, type ContactDto} from "../gen/types.gen.ts";
import {useAppData} from "../hooks/useAppData.ts";
import {useTableFilter} from "../hooks/useTableFilter.ts";
import {usePreferences} from "../stores/usePreferences.ts";
import {numberLocale} from "../utils/number.utils.ts";
import {billingPeriodLabel} from "../utils/data.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {sendJson} from "../lib/api.ts";
import {card, table, td, th, tr} from "../utils/ui.ts";
import SortableTh from "../components/ui/SortableTh.tsx";
import {useSort} from "../utils/sort.utils.ts";

/** Contacts (providers, insurers, landlords, …) whose data entries take over. */
export default function ContactsPage() {
    const data = useAppData();
    const {t} = useTranslation();
    const {mainCurrency} = usePreferences();
    const revalidator = useRevalidator();
    const [searchParams, setSearchParams] = useSearchParams();
    const [editing, setEditing] = useState<ContactDto | null | undefined>(undefined);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggleExpanded = (id: number) => {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpanded(next);
    };

    // ?edit=<id> opens a contact directly (link from an entry)
    useEffect(() => {
        const id = Number(searchParams.get("edit"));
        const contact = id ? data.contacts.find((c) => c.id === id) : undefined;
        if (contact) {
            setEditing(contact);
            setSearchParams({}, {replace: true});
        }
    }, [searchParams, data.contacts, setSearchParams]);

    const format = (v: number) => new Intl.NumberFormat(numberLocale(), {style: "currency", currency: mainCurrency, maximumFractionDigits: 0}).format(v);
    const formatExact = (v: number, currency?: string | null) =>
        new Intl.NumberFormat(numberLocale(), {style: "currency", currency: currency || mainCurrency}).format(v);
    const entriesOf = (contact: ContactDto) => data.contracts.filter((c) => c.contact_id === contact.id);
    const yearly = (contact: ContactDto) => entriesOf(contact)
        .filter((c) => c.kind === EntryKindExpense && c.status !== "expired" && (!c.currency || c.currency === mainCurrency))
        .reduce((sum, c) => sum + (c.monthly_amount ?? 0) * 12, 0);

    const {filtered, toolbar, isFiltered} = useTableFilter(data.contacts, {
        searchText: (c) => [c.name, c.contact_person, c.phone, c.email, c.website, c.address, c.notes].join(" "),
    });
    const {sorted, sort, toggle} = useSort("contacts", filtered, {
        name: (c) => c.name,
        person: (c) => c.contact_person,
        phone: (c) => c.phone,
        entries: (c) => entriesOf(c).length,
        yearly,
    });

    return (
        <div className="flex flex-col gap-6">
            <ContactDialog open={editing !== undefined} contact={editing ?? undefined} onClose={() => setEditing(undefined)}/>
            <PageHeader title={t('contacts.title')} subtitle={t('contacts.subtitle')}
                        actions={<Button onClick={() => setEditing(null)} className="hover:cursor-pointer"><PlusIcon/>{t('contacts.add')}</Button>}/>
            <div className={card}>
                <TableToolbar title={t('contacts.listTitle')} state={toolbar}/>
                <div className="overflow-x-auto -mx-5">
                    <table className={table}>
                        <thead>
                        <tr>
                            <SortableTh sortKey="name" sort={sort} onSort={toggle} className={classNames(th, "pl-5")}>{t('common.name')}</SortableTh>
                            <SortableTh sortKey="person" sort={sort} onSort={toggle} className={classNames(th, "hidden md:table-cell")}>{t('entryForm.contactPerson')}</SortableTh>
                            <SortableTh sortKey="phone" sort={sort} onSort={toggle} className={classNames(th, "hidden lg:table-cell")}>{t('entryForm.phone')}</SortableTh>
                            <SortableTh sortKey="entries" sort={sort} onSort={toggle} className={classNames(th, "text-right")} align="right">{t('contacts.entries')}</SortableTh>
                            <SortableTh sortKey="yearly" sort={sort} onSort={toggle} className={classNames(th, "text-right whitespace-nowrap")} align="right">{t('contacts.perYear')}</SortableTh>
                            <th className={classNames(th, "w-10 pr-5")}/>
                        </tr>
                        </thead>
                        <tbody>
                        {sorted.map((contact) => {
                            const entries = entriesOf(contact);
                            const sum = yearly(contact);
                            return (
                                <Fragment key={contact.id}>
                                <tr className={tr}>
                                    <td className={classNames(td, "pl-5 w-full max-w-0")}>
                                        <button onClick={() => setEditing(contact)} className="flex w-full min-w-0 items-center gap-3 text-left hover:cursor-pointer">
                                            <EntryIcon name={contact.name} icon={contact.icon_source} className="size-8"/>
                                            <span className="min-w-0">
                                                <span className="block truncate font-medium text-zinc-950 dark:text-white">{contact.name}</span>
                                                {(contact.email || contact.website) && (
                                                    <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">{contact.email || contact.website}</span>
                                                )}
                                            </span>
                                        </button>
                                    </td>
                                    <td className={classNames(td, "hidden md:table-cell whitespace-nowrap")}>{contact.contact_person || "–"}</td>
                                    <td className={classNames(td, "hidden lg:table-cell whitespace-nowrap tabular-nums")}>
                                        {contact.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{contact.phone}</a> : "–"}
                                    </td>
                                    <td className={classNames(td, "text-right tabular-nums")}>
                                        {entries.length > 0 ? (
                                            <button onClick={() => toggleExpanded(contact.id)} aria-expanded={expanded.has(contact.id)}
                                                    className="inline-flex items-center gap-1 hover:cursor-pointer hover:text-zinc-950 dark:hover:text-white">
                                                {entries.length}
                                                <ChevronRightIcon className={classNames("size-4 transition-transform", expanded.has(contact.id) ? "rotate-90" : "")}/>
                                            </button>
                                        ) : "–"}
                                    </td>
                                    <td className={classNames(td, "text-right tabular-nums font-medium text-zinc-950 dark:text-white whitespace-nowrap")}>
                                        {sum > 0 ? format(sum) : "–"}
                                    </td>
                                    <td className={classNames(td, "pr-5 text-right")}>
                                        <RowActions onEdit={() => setEditing(contact)} deleteMessage={t('contacts.deleteMessage')} onDelete={async () => {
                                            await sendJson("DELETE", `/contacts/${contact.id}`);
                                            revalidator.revalidate();
                                        }}/>
                                    </td>
                                </tr>
                                {expanded.has(contact.id) && (
                                    <tr>
                                        <td colSpan={6} className="px-5 pb-3">
                                            <ul className="flex flex-col gap-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2">
                                                {entries.map((c) => (
                                                    <li key={c.id}>
                                                        <NavLink to={`/contracts/${c.id}`}
                                                                 className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white dark:hover:bg-zinc-800">
                                                            <EntryIcon name={c.name} icon={c.icon_source}
                                                                       category={data.categories.find((cat) => cat.id === c.category_id)} className="size-6"/>
                                                            <span className="grow truncate text-sm text-zinc-950 dark:text-white">{c.name}</span>
                                                            <span className="text-sm tabular-nums text-zinc-950 dark:text-white whitespace-nowrap">
                                                                {formatExact(c.costs ?? 0, c.currency)}
                                                            </span>
                                                            <span className="hidden sm:block w-28 text-xs text-zinc-400 dark:text-zinc-500">
                                                                {billingPeriodLabel(c.billing_period)}
                                                            </span>
                                                        </NavLink>
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                    </tr>
                                )}
                                </Fragment>
                            );
                        })}
                        {sorted.length === 0 && (
                            <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                                {isFiltered && data.contacts.length > 0 ? t('table.noMatches') : t('contacts.empty')}
                            </td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
