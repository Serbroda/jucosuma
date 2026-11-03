import {useState} from "react";
import {useTranslation} from "react-i18next";
import DonutChart, {type DonutSegment} from "./charts/DonutChart.tsx";
import SegmentedControl from "./SegmentedControl.tsx";
import type {BankActualsDto, BankTransactionDto, CategoryDto} from "../gen/types.gen.ts";
import {type CategorySpending, householdSpending, spendingByCategory} from "../utils/bank.utils.ts";
import {categoryLabel} from "../utils/household.utils.ts";
import {slotColor} from "../lib/icons.ts";
import {card, cardTitle} from "../utils/ui.ts";

type Source = "mine" | "household";

/** Spending of the month per category: the own bookings, or the household totals of all members. */
export default function BookingsCategoryChart({transactions, actuals, categories, format}: {
    transactions: BankTransactionDto[];
    actuals: BankActualsDto | null;
    categories: CategoryDto[];
    format: (value: number) => string;
}) {
    const {t} = useTranslation();
    const [source, setSource] = useState<Source>("mine");
    const shown = source === "household" && actuals ? householdSpending(actuals, categories) : spendingByCategory(transactions, categories);
    const total = shown.reduce((sum, s) => sum + s.amount, 0);
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const segments: DonutSegment[] = shown.map((s: CategorySpending) => {
        const category = s.categoryId != null ? categoryById.get(s.categoryId) : undefined;
        return {
            key: s.categoryId != null ? String(s.categoryId) : "unassigned",
            label: category ? categoryLabel(category.name, category.key) : t("bank.unassigned"),
            value: s.amount,
            // without category: its own neutral, apart from the grey of categories without colour
            color: category ? slotColor(category.color) : "var(--chart-neutral)",
        };
    });

    return (
        <div className={card}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className={cardTitle + " grow"}>{t("bank.chartTitle")}</div>
                {actuals && (
                    <SegmentedControl value={source} onChange={setSource} options={[
                        {value: "mine", label: t("bank.chartMine")},
                        {value: "household", label: t("bank.chartHousehold")},
                    ]}/>
                )}
            </div>
            <DonutChart segments={segments} centerValue={format(total)} centerLabel={t("bank.expenses")}
                        format={format} emptyText={t("bank.chartEmpty")}/>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
                {source === "household" ? t("bank.chartHouseholdHint") : t("bank.chartMineHint")}
            </p>
        </div>
    );
}
