import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {FunnelIcon, MagnifyingGlassIcon, XMarkIcon} from "@heroicons/react/20/solid";
import {Button} from "../catalyst/button.tsx";
import {Input, InputGroup} from "../catalyst/input.tsx";
import {Select} from "../catalyst/select.tsx";
import type {TableFilterState} from "../../hooks/useTableFilter.ts";
import {classNames} from "../../utils/dom.utils.ts";
import {cardTitle} from "../../utils/ui.ts";

/**
 * Head of a table card: title and page controls on the left, search and a filter button on the right.
 * The button shows or hides the filter row and counts the active filters.
 */
export default function TableToolbar({title, children, state}: {
    title?: ReactNode;
    /** page specific controls next to the title, e.g. tabs */
    children?: ReactNode;
    state: TableFilterState;
}) {
    const {t} = useTranslation();
    const hasFilters = state.filters.length > 0;
    return (
        <div className="flex flex-col gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-3">
                {title && <div className={cardTitle}>{title}</div>}
                {children}
                {(state.searchable || hasFilters) && (
                    <div className="ml-auto flex w-full sm:w-auto items-center gap-2">
                        {state.searchable && (
                            <div className="grow sm:w-56">
                                <InputGroup>
                                    <MagnifyingGlassIcon/>
                                    <Input type="search" placeholder={t('common.search')} value={state.search}
                                           onChange={(e) => state.onSearch(e.target.value)}/>
                                </InputGroup>
                            </div>
                        )}
                        {hasFilters && (
                            <Button outline onClick={state.onToggle} aria-expanded={state.open}
                                    title={state.activeCount > 0 ? t('table.filterActive', {count: state.activeCount}) : t('table.filter')}
                                    className={classNames("relative hover:cursor-pointer", state.open ? "bg-zinc-950/5 dark:bg-white/10" : "")}>
                                <FunnelIcon/>
                                {/* dot: filters stay applied while the row is closed */}
                                {state.activeCount > 0 && (
                                    <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-zinc-900"/>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
            {state.open && hasFilters && (
                <div className="flex flex-wrap items-end gap-3 rounded-lg bg-zinc-50 dark:bg-white/5 p-3">
                    {state.filters.map((f) => (
                        <label key={f.key} className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-40 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {f.label}
                            <Select value={state.values[f.key] ?? ""} onChange={(e) => state.onChange(f.key, e.target.value)}>
                                <option value="">{t('table.all')}</option>
                                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                        </label>
                    ))}
                    <Button plain onClick={state.onReset} disabled={state.activeCount === 0}
                            className="sm:ml-auto hover:cursor-pointer disabled:cursor-default">
                        <XMarkIcon/>{t('table.resetFilters')}
                    </Button>
                </div>
            )}
        </div>
    );
}
