import type {ReactNode} from "react";
import {ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon} from "@heroicons/react/16/solid";
import type {SortState} from "../../utils/sort.utils.ts";
import {classNames} from "../../utils/dom.utils.ts";

/** Table header cell that sorts its column on click; shows the direction with an arrow. */
export default function SortableTh({sortKey, sort, onSort, className, align = "left", children}: {
    sortKey: string;
    sort: SortState;
    onSort: (key: string) => void;
    className?: string;
    align?: "left" | "right" | "center";
    children: ReactNode;
}) {
    const active = sort?.key === sortKey;
    const Icon = !active ? ChevronUpDownIcon : sort.dir === "asc" ? ChevronUpIcon : ChevronDownIcon;
    return (
        <th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
            <button type="button" onClick={() => onSort(sortKey)}
                    className={classNames("group inline-flex items-center gap-0.5 hover:cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200",
                        align === "right" ? "flex-row-reverse" : "", active ? "text-zinc-700 dark:text-zinc-200" : "")}>
                {children}
                <Icon className={classNames("size-3.5 shrink-0", active ? "" : "opacity-0 group-hover:opacity-60")}/>
            </button>
        </th>
    );
}
