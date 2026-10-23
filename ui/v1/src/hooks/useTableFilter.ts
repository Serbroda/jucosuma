import {useState} from "react";

/** One filter of a table: a choice of values, each item passes if `test` accepts the chosen value. */
export type TableFilterDef<T> = {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    test: (item: T, value: string) => boolean;
};

export type TableFilterState = {
    search: string;
    onSearch: (value: string) => void;
    searchable: boolean;
    filters: { key: string; label: string; options: { value: string; label: string }[] }[];
    values: Record<string, string>;
    onChange: (key: string, value: string) => void;
    onReset: () => void;
    open: boolean;
    onToggle: () => void;
    activeCount: number;
};

/**
 * Search and filters of a table, applied in the browser. Filters with fewer than two options are left
 * out, as they cannot narrow anything down. Pass the returned `toolbar` to <TableToolbar/>.
 */
export function useTableFilter<T>(items: T[], {searchText, filters = []}: {
    searchText?: (item: T) => string;
    filters?: TableFilterDef<T>[];
}) {
    const [search, setSearch] = useState("");
    const [values, setValues] = useState<Record<string, string>>({});
    const [open, setOpen] = useState(false);

    const usable = filters.filter((f) => f.options.length > 1);
    // a chosen value that no longer exists (e.g. after switching a tab) does not filter
    const active = usable.filter((f) => values[f.key] && f.options.some((o) => o.value === values[f.key]));
    const term = search.trim().toLowerCase();
    const filtered = items.filter((item) =>
        (!term || !searchText || searchText(item).toLowerCase().includes(term))
        && active.every((f) => f.test(item, values[f.key])));

    const toolbar: TableFilterState = {
        search, onSearch: setSearch, searchable: searchText != null,
        filters: usable.map(({key, label, options}) => ({key, label, options})),
        values, onChange: (key, value) => setValues((v) => ({...v, [key]: value})), onReset: () => setValues({}),
        open, onToggle: () => setOpen((o) => !o),
        activeCount: active.length,
    };
    return {filtered, toolbar, isFiltered: term !== "" || active.length > 0};
}
