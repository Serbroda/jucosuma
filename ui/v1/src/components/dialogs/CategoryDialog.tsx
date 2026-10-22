import {useEffect, useState} from "react";
import {useRevalidator} from "react-router";
import {useTranslation} from "react-i18next";
import FormDialog from "./FormDialog.tsx";
import {Description, Field, Label} from "../catalyst/fieldset.tsx";
import SegmentedControl from "../SegmentedControl.tsx";
import NameIconField from "../ui/NameIconField.tsx";
import {EntryKindExpense, EntryKindIncome, type CategoryDto} from "../../gen/types.gen.ts";
import {categoryLabel, defaultCategoryIcon} from "../../utils/household.utils.ts";
import {sendJson} from "../../lib/api.ts";

export default function CategoryDialog({open, onClose, category, defaultType, count}: {
    open: boolean;
    onClose: () => void;
    category?: CategoryDto;
    defaultType: string;
    count: number;
}) {
    const {t} = useTranslation();
    const revalidator = useRevalidator();
    const [name, setName] = useState("");
    const [type, setType] = useState<string>(EntryKindExpense);
    const [color, setColor] = useState<number | undefined>();
    const [icon, setIcon] = useState<string | undefined>();
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        // predefined categories are edited with their translated name
        setName(category ? categoryLabel(category.name, category.key) : "");
        setType(category?.type ?? defaultType);
        setColor(category?.color ?? undefined);
        setIcon(category?.icon ?? undefined);
        setError(null);
    }, [open, category, defaultType]);

    const save = async () => {
        if (!name.trim()) return setError(t('entry.errorName'));
        // keep the stored name of a predefined category unless the user really renamed it
        const storedName = category && name.trim() === categoryLabel(category.name, category.key) ? category.name : name.trim();
        setSaving(true);
        const err = await sendJson(category ? "PUT" : "POST", category ? `/categories/${category.id}` : "/categories", {
            name: storedName,
            sort_order: category?.sort_order ?? count + 1,
            type,
            color: color ?? null,
            icon: icon ?? null,
        });
        setSaving(false);
        if (err) return setError(err);
        revalidator.revalidate();
        onClose();
    };

    return (
        <FormDialog open={open} onClose={onClose} onSubmit={save} saving={saving} error={error}
                    title={category ? t('categories.edit') : t('categories.add')}>
            <NameIconField name={name} onNameChange={setName} icon={icon} color={color} defaultIcon={defaultCategoryIcon}
                           description={category?.key && <Description>{t('categories.renameHint')}</Description>}
                           onIconChange={(i, c) => {
                               setIcon(i);
                               setColor(c);
                           }}/>
            <Field>
                <Label>{t('categories.type')}</Label>
                <div className="mt-2">
                    <SegmentedControl value={type} onChange={setType} options={[
                        {value: EntryKindExpense, label: t('kinds.expense')},
                        {value: EntryKindIncome, label: t('kinds.income')},
                    ]}/>
                </div>
            </Field>
        </FormDialog>
    );
}
