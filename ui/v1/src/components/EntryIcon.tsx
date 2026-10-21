import {Avatar} from "./catalyst/avatar.tsx";
import clsx from "clsx";

/** Initials of an entry name, e.g. "Gehalt Danny" → "GD". */
function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2);
    return words[0][0] + words[1][0];
}

/** The entry's icon, or its initials on a neutral tile when no icon is set. */
export default function EntryIcon({name, icon, className}: { name: string; icon?: string | null; className?: string }) {
    return icon ? (
        <Avatar square src={icon} className={clsx("shrink-0", className)}/>
    ) : (
        <Avatar square initials={initialsOf(name)}
                className={clsx("shrink-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", className)}/>
    );
}
