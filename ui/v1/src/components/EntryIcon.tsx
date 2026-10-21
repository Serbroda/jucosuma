import clsx from "clsx";
import {Avatar} from "./catalyst/avatar.tsx";
import IconTile from "./ui/IconTile.tsx";
import type {CategoryDto} from "../gen/types.gen.ts";
import {parseSymbol} from "../lib/icons.ts";

/** Initials of an entry name, e.g. "Gehalt Danny" → "GD". */
function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2);
    return words[0][0] + words[1][0];
}

/**
 * The entry's own icon (image or built-in symbol); otherwise its category's icon, otherwise its initials.
 */
export default function EntryIcon({name, icon, category, className}: {
    name: string;
    icon?: string | null;
    category?: CategoryDto;
    className?: string;
}) {
    const symbol = parseSymbol(icon);
    if (symbol) return <IconTile icon={symbol.icon} color={symbol.color} className={className}/>;
    if (icon) return <Avatar square src={icon} className={clsx("shrink-0", className)}/>;
    if (category?.icon) return <IconTile icon={category.icon} color={category.color} className={className}/>;
    return (
        <Avatar square initials={initialsOf(name)}
                className={clsx("shrink-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", className)}/>
    );
}
