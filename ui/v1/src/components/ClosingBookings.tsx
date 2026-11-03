import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ChevronDownIcon} from "@heroicons/react/16/solid";
import type {BankCategoryActualDto, BankTransactionDto, ContractDto} from "../gen/types.gen.ts";
import dayjs from "../lib/dayjs";

/** Below a category of the closing: what the imported bookings add up to, expandable to the own
 * bookings (others' only as totals), and an offer to update the stored actual value. */
export default function ClosingBookings({booked, actual, own, userId, contracts, format, onUpdate}: {
    booked: BankCategoryActualDto;
    actual: number;
    /** the current user's household bookings of the category in the month */
    own: BankTransactionDto[];
    userId?: number;
    contracts: ContractDto[];
    format: (v: number, digits?: number) => string;
    onUpdate: () => void;
}) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const others = booked.by_user.filter((u) => u.user_id !== userId);
    const differs = Math.abs(booked.amount - actual) >= 0.005;
    const entryName = (id?: number) => contracts.find((c) => c.id === id)?.name;

    return (
        <div className="ml-10 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 hover:cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200">
                    <ChevronDownIcon className={"size-3.5 transition-transform " + (open ? "rotate-180" : "")}/>
                    {t("closing.fromBookings", {amount: format(booked.amount, 2), count: booked.bookings})}
                </button>
                {differs && (
                    <span className="text-amber-700 dark:text-amber-400">
                        · {t("closing.differs")}{" "}
                        <button type="button" onClick={onUpdate} className="font-medium hover:underline hover:cursor-pointer">{t("closing.update")}</button>
                    </span>
                )}
            </div>
            {open && (
                <ul className="mt-1.5 flex flex-col gap-0.5 border-l border-zinc-200 dark:border-zinc-700 pl-3">
                    {own.map((tx) => (
                        <li key={tx.id} className="flex gap-3">
                            <span className="tabular-nums w-10 shrink-0">{dayjs(tx.booking_date).format("DD.MM.")}</span>
                            <span className="grow truncate text-zinc-700 dark:text-zinc-300">
                                {tx.counterparty || tx.booking_text || t("closing.detailsRemoved")}
                                {entryName(tx.contract_id) && <span className="text-zinc-400 dark:text-zinc-500"> · {entryName(tx.contract_id)}</span>}
                            </span>
                            <span className="tabular-nums">{format(-tx.amount, 2)}</span>
                        </li>
                    ))}
                    {others.map((u) => (
                        <li key={u.user_id} className="flex gap-3 italic">
                            <span className="grow">{t("closing.othersBookings", {count: u.bookings, name: u.name})}</span>
                            <span className="tabular-nums">{format(u.amount, 2)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
