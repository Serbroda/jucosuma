import clsx from "clsx";
import {useTranslation} from "react-i18next";
import {colorSlots, icons, slotColor} from "../../lib/icons.ts";

/** Pickers for a palette colour slot and an icon key. */
export function ColorPicker({value, onChange}: { value?: number | null; onChange: (slot: number | undefined) => void }) {
    const {t} = useTranslation();
    return (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('categories.color')}>
            {[undefined, ...colorSlots].map((slot) => (
                <button
                    key={slot ?? 0}
                    type="button"
                    role="radio"
                    aria-checked={value === slot || (!value && !slot)}
                    aria-label={slot ? `${t('categories.color')} ${slot}` : t('categories.noColor')}
                    onClick={() => onChange(slot)}
                    className={clsx("size-7 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 hover:cursor-pointer",
                        (value ?? undefined) === slot ? "ring-2 ring-zinc-900 dark:ring-white" : "")}
                    style={{background: slotColor(slot)}}
                />
            ))}
        </div>
    );
}

export function IconPicker({value, color, onChange}: {
    value?: string | null;
    color?: number | null;
    onChange: (icon: string) => void;
}) {
    const {t} = useTranslation();
    return (
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label={t('categories.icon')}>
            {Object.entries(icons).map(([key, Icon]) => (
                <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={value === key}
                    aria-label={key}
                    onClick={() => onChange(key)}
                    className={clsx("flex items-center justify-center aspect-square rounded-lg hover:cursor-pointer",
                        value === key ? "ring-2 ring-zinc-900 dark:ring-white"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")}
                    style={value === key ? {background: `color-mix(in srgb, ${slotColor(color)} 16%, transparent)`, color: slotColor(color)} : undefined}
                >
                    <Icon className="size-5"/>
                </button>
            ))}
        </div>
    );
}
