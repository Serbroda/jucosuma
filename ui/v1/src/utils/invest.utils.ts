import {InvestModeFixed} from "../gen/types.gen.ts";

/** What the allocation needs of a position: a fixed amount or a percentage. */
export type InvestPosition = { mode: string; value: number };

export type InvestAllocation = {
    /** amount per position, in the order of the positions (rounded to cents) */
    amounts: number[];
    /** sum of the fixed positions */
    fixed: number;
    /** what the fixed positions leave for the percentages (never below 0) */
    rest: number;
    /** sum of the percentages (100 spreads the whole rest) */
    percent: number;
    /** part of the plan's amount no position takes; negative when the positions take more */
    unallocated: number;
};

const cents = (value: number) => Math.round(value * 100);

/**
 * Spreads a monthly amount over positions: fixed amounts first, the percentages share what is left.
 * Percentages adding up to 100 spread the rest to the cent (largest remainders get the odd cents).
 */
export function allocateInvestPlan(amount: number, positions: InvestPosition[]): InvestAllocation {
    const isFixed = (p: InvestPosition) => p.mode === InvestModeFixed;
    const fixed = positions.reduce((sum, p) => sum + (isFixed(p) ? cents(p.value) : 0), 0);
    const percent = positions.reduce((sum, p) => sum + (isFixed(p) ? 0 : p.value), 0);
    const rest = Math.max(0, cents(amount) - fixed);

    const exact = positions.map((p) => isFixed(p) ? cents(p.value) : rest * p.value / 100);
    const parts = exact.map(Math.floor);
    if (Math.abs(percent - 100) < 1e-6) {
        let left = rest - positions.reduce((sum, p, i) => sum + (isFixed(p) ? 0 : parts[i]), 0);
        const byRemainder = positions.map((_, i) => i).filter((i) => !isFixed(positions[i]))
            .sort((a, b) => (exact[b] - parts[b]) - (exact[a] - parts[a]));
        for (const i of byRemainder) {
            if (left <= 0) break;
            parts[i] += 1;
            left -= 1;
        }
    } else {
        exact.forEach((value, i) => parts[i] = Math.round(value));
    }

    const allocated = parts.reduce((sum, part) => sum + part, 0);
    return {
        amounts: parts.map((part) => part / 100),
        fixed: fixed / 100,
        rest: rest / 100,
        percent,
        unallocated: (cents(amount) - allocated) / 100,
    };
}
