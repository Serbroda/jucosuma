import {useState} from "react";
import {classNames} from "../utils/dom.utils.ts";
import {useTranslation} from "react-i18next";
import {NavLink} from "react-router";
import {EnvelopeIcon, GlobeAltIcon, MapPinIcon, PhoneIcon, UserIcon} from "@heroicons/react/16/solid";
import EntryIcon from "./EntryIcon.tsx";
import {Description, Field, Label} from "./catalyst/fieldset.tsx";
import {Input} from "./catalyst/input.tsx";
import {Textarea} from "./catalyst/textarea.tsx";
import {Combobox, ComboboxDescription, ComboboxLabel, ComboboxOption} from "./catalyst/combobox.tsx";
import ContactDialog from "./dialogs/ContactDialog.tsx";
import type {CompanyDto, ContactDto, ContractDto} from "../gen/types.gen.ts";

type ProviderOption = { name: string; contactId?: number };

const linkButton = "text-sm text-blue-600 dark:text-blue-400 hover:underline hover:cursor-pointer";

/**
 * Provider and contact data of an entry. A linked contact supplies its data; fields filled on the
 * entry override it for this entry only. Without a contact the fields are simply the entry's own.
 */
export default function ContactFields({contract, companies, contacts}: {
    contract: Partial<ContractDto>;
    companies: CompanyDto[];
    contacts: ContactDto[];
}) {
    const {t} = useTranslation();
    const [provider, setProvider] = useState<ProviderOption>({name: contract.company ?? "", contactId: contract.contact_id ?? undefined});
    const [fields, setFields] = useState({
        website: contract.website ?? "",
        contact_person: contract.contact_person ?? "",
        contact_address: contract.contact_address ?? "",
        contact_phone: contract.contact_phone ?? "",
        contact_email: contract.contact_email ?? "",
    });
    const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
    // with a contact the own fields are only overrides; they open on demand
    const [showOverrides, setShowOverrides] = useState(Object.values(fields).some((v) => v.trim()));
    const contact = contacts.find((k) => k.id === provider.contactId);

    const byName = (name: string) => contacts.find((k) => k.name.trim().toLowerCase() === name.trim().toLowerCase());
    const contactNames = new Set(contacts.map((k) => k.name.trim().toLowerCase()));
    const options: ProviderOption[] = [
        ...contacts.map((k) => ({name: k.name, contactId: k.id})),
        ...companies.filter((c) => c.name && !contactNames.has(c.name.trim().toLowerCase())).map((c) => ({name: c.name})),
    ];
    if (provider.name.trim() && !options.some((o) => o.name === provider.name)) options.push({name: provider.name});

    const shown = contact ? [
        {key: "contact_phone", icon: PhoneIcon, own: fields.contact_phone.trim(), fallback: contact.phone},
        {key: "contact_email", icon: EnvelopeIcon, own: fields.contact_email.trim(), fallback: contact.email},
        {key: "website", icon: GlobeAltIcon, own: fields.website.trim(), fallback: contact.website},
        {key: "contact_person", icon: UserIcon, own: fields.contact_person.trim(), fallback: contact.contact_person},
        {key: "contact_address", icon: MapPinIcon, own: fields.contact_address.trim(), fallback: contact.address},
    ].map((f) => ({key: f.key, icon: f.icon, value: f.own || f.fallback?.trim() || "", own: Boolean(f.own)}))
        .filter((f) => f.value) : [];
    const set = (key: keyof typeof fields) => (e: { target: { value: string } }) => setFields({...fields, [key]: e.target.value});
    const hasOwnData = Object.values(fields).some((v) => v.trim());

    // creating a contact from the entry moves the typed data into it
    const linkNew = (created: ContactDto) => {
        setProvider({name: created.name, contactId: created.id});
        setFields({website: "", contact_person: "", contact_address: "", contact_phone: "", contact_email: ""});
    };

    return (
        <>
            <ContactDialog open={dialog !== null} onClose={() => setDialog(null)}
                           contact={dialog === "edit" ? contact : undefined}
                           initial={dialog === "create" ? {
                               name: provider.name, website: fields.website, contact_person: fields.contact_person,
                               address: fields.contact_address, phone: fields.contact_phone, email: fields.contact_email,
                           } : undefined}
                           onSaved={dialog === "create" ? linkNew : undefined}/>
            <input type="hidden" name="contact_id" value={provider.contactId ?? ""}/>
            <Field>
                <Label>{t('entryForm.company')}</Label>
                <Combobox<ProviderOption>
                    name="company"
                    options={options}
                    value={provider}
                    by={(a, b) => a?.name === b?.name}
                    onChange={(option) => option && setProvider(option)}
                    onInputChange={(e) => setProvider({name: e.target.value, contactId: byName(e.target.value)?.id})}
                    displayValue={(o) => o?.name}>
                    {(o) => (
                        <ComboboxOption value={o}>
                            <ComboboxLabel>{o.name}</ComboboxLabel>
                            {o.contactId != null && <ComboboxDescription>{t('contacts.contact')}</ComboboxDescription>}
                        </ComboboxOption>
                    )}
                </Combobox>
                {!contact && (provider.name.trim() || hasOwnData) && (
                    <Description className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{t('contacts.notLinked')}</span>
                        <button type="button" onClick={() => setDialog("create")} className={linkButton}>{t('contacts.saveAsContact')}</button>
                        {contacts.length > 0 && <NavLink to="/settings/contacts" className={linkButton}>{t('contacts.manage')}</NavLink>}
                    </Description>
                )}
            </Field>
            {contact && (
                <div className="rounded-lg border border-zinc-950/10 dark:border-white/10 p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <EntryIcon name={contact.name} icon={contact.icon_source} className="size-8"/>
                        <span className="min-w-0 grow">
                            <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{contact.name}</span>
                            <span className="block text-xs text-zinc-400 dark:text-zinc-500">{t('contacts.contact')}</span>
                        </span>
                        <span className="flex gap-3">
                            <button type="button" onClick={() => setDialog("edit")} className={linkButton}>{t('contacts.editData')}</button>
                            <button type="button" onClick={() => setProvider({name: provider.name})} className={linkButton}>{t('contacts.unlink')}</button>
                        </span>
                    </div>
                    {shown.length > 0 ? (
                        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                            {shown.map(({key, icon: Icon, value, own}) => (
                                <li key={key} className="flex items-start gap-2">
                                    <Icon className="mt-0.5 size-4 shrink-0 fill-zinc-400 dark:fill-zinc-500"/>
                                    <span className="min-w-0 whitespace-pre-line break-words">{value}</span>
                                    {own && (
                                        <span className="shrink-0 rounded bg-amber-50 px-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                            {t('contacts.onlyThisEntry')}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">{t('contacts.noData')}</p>
                    )}
                    {!showOverrides && (
                        <button type="button" onClick={() => setShowOverrides(true)} className={classNames(linkButton, "mt-3")}>
                            {t('contacts.override')}
                        </button>
                    )}
                </div>
            )}
            {/* own fields: without contact the entry's data, with contact overrides (kept mounted so they are submitted) */}
            <div className={classNames("grid grid-cols-1 gap-4", contact && !showOverrides ? "hidden" : "")}>
                {contact && <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('contacts.overrideHint')}</p>}
                <Field>
                    <Label>{t('entryForm.website')}</Label>
                    <Input name="website" inputMode="url" placeholder={contact?.website || "https://www.…"}
                           value={fields.website} onChange={set("website")}/>
                </Field>
                <Field>
                    <Label>{t('entryForm.contactPerson')}</Label>
                    <Input name="contact_person" placeholder={contact?.contact_person ?? ""}
                           value={fields.contact_person} onChange={set("contact_person")}/>
                </Field>
                <Field>
                    <Label>{t('entryForm.address')}</Label>
                    <Textarea name="contact_address" placeholder={contact?.address ?? ""}
                              value={fields.contact_address} onChange={set("contact_address")}/>
                </Field>
                <Field>
                    <Label>{t('entryForm.phone')}</Label>
                    <Input name="contact_phone" type="tel" placeholder={contact?.phone ?? ""}
                           value={fields.contact_phone} onChange={set("contact_phone")}/>
                </Field>
                <Field>
                    <Label>{t('entryForm.email')}</Label>
                    <Input name="contact_email" placeholder={contact?.email ?? ""}
                           value={fields.contact_email} onChange={set("contact_email")}/>
                </Field>
            </div>
        </>
    );
}
