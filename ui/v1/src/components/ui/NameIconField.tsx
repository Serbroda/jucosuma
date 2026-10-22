import {type ReactNode, useState} from "react";
import {useTranslation} from "react-i18next";
import {Field, Label} from "../catalyst/fieldset.tsx";
import {Input} from "../catalyst/input.tsx";
import {Button} from "../catalyst/button.tsx";
import IconTile from "./IconTile.tsx";
import IconButton from "./IconButton.tsx";
import {ColorPicker, IconPicker} from "./ColorIconPicker.tsx";

/**
 * Name field with the icon in front of it, as everywhere in the app. A click on the icon shows colour and
 * symbol; without own choice the defaults apply (e.g. by account type), "Default" goes back to them.
 */
export default function NameIconField({name, onNameChange, placeholder, description, icon, color, defaultIcon, defaultColor, onIconChange}: {
    name: string;
    onNameChange: (name: string) => void;
    placeholder?: string;
    description?: ReactNode;
    icon?: string | null;
    color?: number | null;
    defaultIcon: string;
    defaultColor?: number;
    onIconChange: (icon: string | undefined, color: number | undefined) => void;
}) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const shownIcon = icon || defaultIcon;
    const shownColor = color ?? defaultColor;
    const custom = Boolean(icon) || color != null;
    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                <IconButton onClick={() => setOpen(!open)} active={open}>
                    <IconTile icon={shownIcon} color={shownColor} className="size-9"/>
                </IconButton>
                <Field>
                    <Label>{t('common.name')}</Label>
                    <Input autoFocus value={name} onChange={(e) => onNameChange(e.target.value)} placeholder={placeholder}/>
                </Field>
            </div>
            {description}
            {open && (
                <div className="flex flex-col gap-3 rounded-lg border border-zinc-950/10 dark:border-white/10 p-3">
                    <ColorPicker value={shownColor} onChange={(c) => onIconChange(icon ?? undefined, c)}/>
                    <IconPicker value={shownIcon} color={shownColor} onChange={(i) => onIconChange(i, color ?? undefined)}/>
                    <div className="flex justify-end gap-2">
                        {custom && (
                            <Button plain type="button" onClick={() => onIconChange(undefined, undefined)} className="hover:cursor-pointer">
                                {t('icons.default')}
                            </Button>
                        )}
                        <Button outline type="button" onClick={() => setOpen(false)} className="hover:cursor-pointer">{t('icons.done')}</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
