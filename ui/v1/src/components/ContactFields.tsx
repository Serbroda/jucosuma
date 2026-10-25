import {useState} from "react";
import {useTranslation} from "react-i18next";
import {NavLink} from "react-router";
import {LinkIcon} from "@heroicons/react/16/solid";
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
    const contact = contacts.find((k) => k.id === provider.contactId);

    const byName = (name: string) => contacts.find((k) => k.name.trim().toLowerCase() === name.trim().toLowerCase());
    const contactNames = new Set(contacts.map((k) => k.name.trim().toLowerCase()));
    const options: ProviderOption[] = [
        ...contacts.map((k) => ({name: k.name, contactId: k.id})),
        ...companies.filter((c) => c.name && !contactNames.has(c.name.trim().toLowerCase())).map((c) => ({name: c.name})),
    ];
    if (provider.name.trim() && !options.some((o) => o.name === provider.name)) options.push({name: provider.name});

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
                {contact ? (
                    <Description className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1.5">
                            <LinkIcon className="size-3.5 fill-zinc-400"/>
                            {t('contacts.linked')}
                        </span>
                        <button type="button" onClick={() => setDialog("edit")} className={linkButton}>{t('contacts.editData')}</button>
                        <button type="button" onClick={() => setProvider({name: provider.name})} className={linkButton}>{t('contacts.unlink')}</button>
                    </Description>
                ) : (provider.name.trim() || hasOwnData) && (
                    <Description className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{t('contacts.notLinked')}</span>
                        <button type="button" onClick={() => setDialog("create")} className={linkButton}>{t('contacts.saveAsContact')}</button>
                        {contacts.length > 0 && <NavLink to="/settings/contacts" className={linkButton}>{t('contacts.manage')}</NavLink>}
                    </Description>
                )}
            </Field>
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
                {contact && <Description>{t('contacts.overrideHint')}</Description>}
            </Field>
        </>
    );
}
