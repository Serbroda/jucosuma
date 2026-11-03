import {useEffect, useState} from "react";
import type {BankActualsDto} from "../gen/types.gen.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";

/** Household totals of a month's imported bookings (YYYY-MM); null while loading or without imports.
 * A changed `refresh` value loads them again, e.g. after bookings were assigned. */
export function useBankActuals(month: string, enabled = true, refresh?: unknown): BankActualsDto | null {
    const [actuals, setActuals] = useState<BankActualsDto | null>(null);
    useEffect(() => {
        if (!enabled) return;
        let current = true;
        apiFetch(`${apiBasePath}/bank_actuals?month=${month}`).then(async (res) => {
            const body: BankActualsDto | null = res.ok ? await res.json() : null;
            // no import touches the month: nothing to suggest
            if (current) setActuals(body && (body.categories.length > 0 || body.unassigned.bookings > 0 || body.coverage.some((c) => c.covered_until)) ? body : null);
        });
        return () => {
            current = false;
        };
    }, [month, enabled, refresh]);
    return actuals;
}
