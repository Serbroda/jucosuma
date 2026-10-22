import {useMemo, useState} from "react";
import {numberLocale} from "./number.utils.ts";

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;
type SortValue = string | number | boolean | null | undefined;

/** Values a table column is sorted by. */
export type SortAccessors<T> = Record<string, (item: T) => SortValue>;

function compare(a: SortValue, b: SortValue): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return String(a).localeCompare(String(b), numberLocale(), {numeric: true, sensitivity: "base"});
}

const empty = (v: SortValue) => v == null || v === "";

function read(id: string): SortState {
    try {
        const raw = localStorage.getItem(`sort:${id}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function write(id: string, state: SortState) {
    try {
        if (state) localStorage.setItem(`sort:${id}`, JSON.stringify(state));
        else localStorage.removeItem(`sort:${id}`);
    } catch {
        // storage unavailable: sorting just isn't remembered
    }
}

/** Sorts a copy of the items by a value; empty values always go last. */
export function sortItems<T>(items: T[], get: (item: T) => SortValue, dir: SortDir): T[] {
    const factor = dir === "asc" ? 1 : -1;
    return [...items].sort((x, y) => {
        const a = get(x), b = get(y);
        if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? 1 : -1;
        return compare(a, b) * factor;
    });
}

/**
 * Sorting of a table by clicking column headers: first click sorts (texts A–Z, numbers and dates
 * largest first), second click reverses, third click restores the table's own order. Empty values
 * always go last. The choice is remembered per table in this browser.
 */
export function useSort<T>(id: string, items: T[], accessors: SortAccessors<T>) {
    const [state, setState] = useState<SortState>(() => {
        const stored = read(id);
        return stored && accessors[stored.key] ? stored : null;
    });

    const sorted = useMemo(() => state && accessors[state.key] ? sortItems(items, accessors[state.key], state.dir) : items,
        // accessors are recreated on every render; the items and the state decide the order
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [items, state]);

    const toggle = (key: string) => {
        let next: SortState;
        if (state?.key !== key) {
            const sample = items.map(accessors[key]).find((v) => !empty(v));
            next = {key, dir: typeof sample === "string" ? "asc" : "desc"};
        } else {
            const first = state.dir;
            const sample = items.map(accessors[key]).find((v) => !empty(v));
            const initial: SortDir = typeof sample === "string" ? "asc" : "desc";
            next = first === initial ? {key, dir: first === "asc" ? "desc" : "asc"} : null;
        }
        setState(next);
        write(id, next);
    };

    return {sorted, sort: state, toggle};
}
