import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import {Description, Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Select} from "../catalyst/select.tsx";
import type {PersonDto, UserOptionDto} from "../../gen/types.gen.ts";
import {sendJson} from "../../lib/api.ts";
import {apiFetch} from "../../lib/fetch.ts";
import {apiBasePath} from "../../config.ts";
import {useAuth} from "../../stores/useAuth.ts";

export default function PersonDialog({open, onClose, person, persons}: {
    open: boolean;
    onClose: () => void;
    person?: PersonDto;
    persons: PersonDto[];
}) {
    const {t} = useTranslation();
    const {user} = useAuth();
    const revalidator = useRevalidator();
    const [name, setName] = useState("");
    const [member, setMember] = useState(true);
    const [userId, setUserId] = useState("");
    const [logins, setLogins] = useState<UserOptionDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(person?.name ?? "");
        setMember(person?.in_household ?? true);
        setUserId(person?.user_id != null ? String(person.user_id) : "");
        setError(null);
        apiFetch(`${apiBasePath}/user_options`).then(async (res) => res.ok && setLogins(await res.json()));
    }, [open, person]);

    const taken = (loginId: number) => persons.some((p) => p.id !== person?.id && p.user_id === loginId);

    const save = async () => {
        if (!name.trim()) return setError(t('entry.errorName'));
        setSaving(true);
        const err = await sendJson(person ? "PUT" : "POST", person ? `/persons/${person.id}` : "/persons", {
            name: name.trim(),
            in_household: member,
            user_id: userId ? Number(userId) : null,
            sort_order: person?.sort_order ?? persons.length,
        });
        setSaving(false);
        if (err) return setError(err);
        revalidator.revalidate();
        onClose();
    };

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={person ? t('persons.edit') : t('persons.add')}>
            <Field>
                <Label>{t('common.name')}</Label>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('household.personPlaceholder')}/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field>
                    <Label>{t('household.membership')}</Label>
                    <Select value={member ? "household" : "external"} onChange={(e) => setMember(e.target.value === "household")}>
                        <option value="household">{t('household.member')}</option>
                        <option value="external">{t('household.external')}</option>
                    </Select>
                </Field>
                <Field>
                    <Label>{t('household.login')}</Label>
                    <Select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={!member}>
                        <option value="">{t('household.noLogin')}</option>
                        {logins.map((l) => (
                            <option key={l.id} value={l.id} disabled={taken(l.id)}>
                                {l.username}{l.id === user?.id ? ` ${t('household.you')}` : ""}
                            </option>
                        ))}
                    </Select>
                </Field>
            </div>
            <Description>{member ? t('persons.memberHint') : t('persons.externalHint')}</Description>
        </FormDialog>
    );
}
