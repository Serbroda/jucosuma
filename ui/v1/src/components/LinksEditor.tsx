import {useTranslation} from "react-i18next";
import {PlusIcon, XMarkIcon} from "@heroicons/react/16/solid";
import {Input} from "./catalyst/input.tsx";
import {Button} from "./catalyst/button.tsx";

export type EditableLink = { title: string; url: string };

/** Editable list of links (title + address), e.g. a customer portal or documents in Paperless. */
export default function LinksEditor({value, onChange}: { value: EditableLink[]; onChange: (links: EditableLink[]) => void }) {
    const {t} = useTranslation();
    const update = (i: number, patch: Partial<EditableLink>) => onChange(value.map((l, j) => (j === i ? {...l, ...patch} : l)));

    return (
        <div className="flex flex-col gap-2">
            {value.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[12rem_1fr_auto] gap-2 items-start">
                    <Input aria-label={t('entryForm.linkTitle')} placeholder={t('entryForm.linkTitle')} value={l.title}
                           onChange={(e) => update(i, {title: e.target.value})} className="col-span-1"/>
                    <Input aria-label={t('entryForm.linkUrl')} placeholder="https://…" inputMode="url" value={l.url}
                           onChange={(e) => update(i, {url: e.target.value})}
                           className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-1 sm:col-start-2"/>
                    <Button plain type="button" aria-label={t('common.delete')} onClick={() => onChange(value.filter((_, j) => j !== i))}
                            className="hover:cursor-pointer col-start-2 row-start-1 sm:col-start-3">
                        <XMarkIcon/>
                    </Button>
                </div>
            ))}
            <div>
                <Button outline type="button" onClick={() => onChange([...value, {title: "", url: ""}])} className="hover:cursor-pointer">
                    <PlusIcon/>{t('entryForm.addLink')}
                </Button>
            </div>
        </div>
    );
}
