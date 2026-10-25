import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import ChooseIconDialog from "./ChooseIconDialog.tsx";
import {Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Textarea} from "../catalyst/textarea.tsx";
import IconButton from "../ui/IconButton.tsx";
import EntryIcon from "../EntryIcon.tsx";
import type {ContactDto} from "../../gen/types.gen.ts";
import {apiFetch} from "../../lib/fetch.ts";
import {apiBasePath} from "../../config.ts";

type ContactValues = Omit<ContactDto, "id" | "created_at" | "updated_at">;

const empty: ContactValues = {name: "", icon_source: "", contact_person: "", address: "", phone: "", email: "", website: "", notes: ""};

/**
 * Creates or edits a contact. `initial` prefills a new contact, e.g. with the data typed into an entry.
 * `onSaved` gets the stored contact (to link it right away).
 */
export default function ContactDialog({open, onClose, contact, initial, onSaved}: {
    open: boolean;
    onClose: () => void;
    contact?: ContactDto;
    initial?: Partial<ContactValues>;
    onSaved?: (contact: ContactDto) => void;
}) {
    const {t} = useTranslation();
    const revalidator = useRevalidator();
    const [values, setValues] = useState<ContactValues>(empty);
    const [chooseIcon, setChooseIcon] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        const source = contact ?? initial ?? {};
        setValues(Object.fromEntries(Object.keys(empty).map((k) => [k, source[k as keyof ContactValues] ?? ""])) as ContactValues);
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, contact]);

    const set = (key: keyof ContactValues) => (e: { target: { value: string } }) => setValues({...values, [key]: e.target.value});

    const save = async () => {
        if (!values.name.trim()) return setError(t('entry.errorName'));
        setSaving(true);
        const res = await apiFetch(`${apiBasePath}/contacts${contact ? `/${contact.id}` : ""}`, {
            method: contact ? "PUT" : "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(values),
        });
        setSaving(false);
        if (!res.ok) {
            const text = await res.text();
            try {
                return setError(JSON.parse(text).message ?? text);
            } catch {
                return setError(text || res.statusText);
            }
        }
        onSaved?.(await res.json());
        revalidator.revalidate();
        onClose();
    };

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={contact ? t('contacts.edit') : t('contacts.add')}>
            <ChooseIconDialog isOpen={chooseIcon} onClose={() => setChooseIcon(false)}
                              onSubmit={(source) => {
                                  setValues({...values, icon_source: source});
                                  setChooseIcon(false);
                              }}/>
            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                <IconButton onClick={() => setChooseIcon(true)}>
                    <EntryIcon name={values.name || "?"} icon={values.icon_source} className="size-9"/>
                </IconButton>
                <Field>
                    <Label>{t('common.name')}</Label>
                    <Input autoFocus value={values.name} onChange={set("name")} placeholder={t('contacts.namePlaceholder')}/>
                </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field>
                    <Label>{t('entryForm.contactPerson')}</Label>
                    <Input value={values.contact_person ?? ""} onChange={set("contact_person")}/>
                </Field>
                <Field>
                    <Label>{t('entryForm.phone')}</Label>
                    <Input type="tel" value={values.phone ?? ""} onChange={set("phone")}/>
                </Field>
                <Field>
                    <Label>{t('entryForm.email')}</Label>
                    <Input type="email" value={values.email ?? ""} onChange={set("email")}/>
                </Field>
                <Field>
                    <Label>{t('entryForm.website')}</Label>
                    <Input inputMode="url" placeholder="https://www.…" value={values.website ?? ""} onChange={set("website")}/>
                </Field>
            </div>
            <Field>
                <Label>{t('entryForm.address')}</Label>
                <Textarea rows={3} value={values.address ?? ""} onChange={set("address")}/>
            </Field>
            <Field>
                <Label>{t('entryForm.notes')}</Label>
                <Textarea rows={2} value={values.notes ?? ""} onChange={set("notes")}/>
            </Field>
        </FormDialog>
    );
}
