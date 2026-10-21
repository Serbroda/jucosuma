import {create} from "zustand";
import type {Dayjs} from "dayjs";
import dayjs from "../lib/dayjs";
import type {MonthMode} from "../utils/budget.utils.ts";

const storageKey = "selectedMonth";

function initialMonth(): string {
    try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored && /^\d{4}-\d{2}$/.test(stored)) return stored;
    } catch {
        // storage unavailable
    }
    return dayjs().format("YYYY-MM");
}

type MonthState = {
    /** Selected month as YYYY-MM, shared by all pages. */
    month: string;
    mode: MonthMode;
    setMonth: (month: Dayjs) => void;
    setMode: (mode: MonthMode) => void;
};

export const useMonthStore = create<MonthState>((set) => ({
    month: initialMonth(),
    mode: "average",
    setMonth: (month) => {
        const value = month.format("YYYY-MM");
        try {
            sessionStorage.setItem(storageKey, value);
        } catch {
            // storage unavailable
        }
        set({month: value});
    },
    setMode: (mode) => set({mode}),
}));

/** The selected month as dayjs (first day) plus mode and setters. */
export function useMonth() {
    const {month, mode, setMonth, setMode} = useMonthStore();
    return {month: dayjs(`${month}-01`), monthKey: month, mode, setMonth, setMode};
}
