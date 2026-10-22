import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Field, Label} from "../catalyst/fieldset.tsx";
import {Button} from "../catalyst/button.tsx";
import IconTile from "./IconTile.tsx";
import {ColorPicker, IconPicker} from "./ColorIconPicker.tsx";

/**
 * Icon and colour of an account, goal or category: a preview with the pickers behind "Change".
 * Without own choice the defaults apply (e.g. by account type); "Default" goes back to them.
 */
export default function IconField({icon, color, defaultIcon, defaultColor, onChange}: {
    icon?: string | null;
    color?: number | null;
    defaultIcon: string;
    defaultColor?: number;
    onChange: (icon: string | undefined, color: number | undefined) => void;
}) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const shownIcon = icon || defaultIcon;
    const shownColor = color ?? defaultColor;
    const custom = Boolean(icon) || color != null;
    return (
        <Field>
            <Label>{t('icons.icon')}</Label>
            <div className="mt-2 flex items-center gap-3">
                <IconTile icon={shownIcon} color={shownColor} className="size-9"/>
                <Button plain type="button" onClick={() => setOpen(!open)} className="hover:cursor-pointer">
                    {open ? t('icons.done') : t('icons.change')}
                </Button>
                {custom && (
                    <Button plain type="button" onClick={() => onChange(undefined, undefined)} className="hover:cursor-pointer">
                        {t('icons.default')}
                    </Button>
                )}
            </div>
            {open && (
                <div className="mt-3 flex flex-col gap-3">
                    <ColorPicker value={shownColor} onChange={(c) => onChange(icon ?? undefined, c)}/>
                    <IconPicker value={shownIcon} color={shownColor} onChange={(i) => onChange(i, color ?? undefined)}/>
                </div>
            )}
        </Field>
    );
}
