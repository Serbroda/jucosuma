import {describe, expect, it} from "vitest";
import dayjs from "../lib/dayjs";
import {compareMonth, variableCategories, variableCostsYear} from "./closing.utils.ts";
import {
    accounts, categories, closing, expense, groceries, income, insurance, joint, persons, transport,
} from "../test/fixtures.ts";

const oct = dayjs("2026-10-01");

describe("variableCategories", () => {
    it("only offers categories with variable costs (and earlier tracked ones)", () => {
        const entries = [
            expense(600, {is_variable: true, category_id: groceries.id}),
            expense(58, {category_id: transport.id}), // monthly ticket: fixed
            expense(30, {is_contract: true, category_id: insurance.id}),
        ];
        expect(variableCategories(oct, [], entries, categories).map((c) => c.key)).toEqual(["groceries"]);
        const tracked = [closing("2026-09", {actuals: [{category_id: transport.id, amount: 90}]})];
        expect(variableCategories(oct, tracked, entries, categories).map((c) => c.key)).toEqual(["groceries", "transport"]);
    });
});

describe("compareMonth", () => {
    const entries = [
        income(3000, {account_id: joint.id}),
        expense(2000, {account_id: joint.id}),
        expense(120, {account_id: joint.id, is_variable: true, category_id: transport.id}), // fuel
        expense(58, {account_id: joint.id, category_id: transport.id}), // monthly ticket, fixed
    ];

    it("compares the real balance change of a pot with the planned change", () => {
        const closings = [
            closing("2026-09", {balances: [{account_id: joint.id, balance: 5000}]}),
            closing("2026-10", {balances: [{account_id: joint.id, balance: 5700}]}),
        ];
        const c = compareMonth(oct, closings, entries, persons, accounts, categories, "EUR");
        const household = c.pots.find((p) => p.pot === "household")!;
        expect(household.planned).toBeCloseTo(3000 - 2000 - 120 - 58);
        expect(household.actual).toBe(700);
        expect(household.deviation).toBeCloseTo(700 - 822);
    });

    it("compares actual amounts with the variable part of the category plan only", () => {
        const closings = [closing("2026-10", {actuals: [{category_id: transport.id, amount: 150}]})];
        const c = compareMonth(oct, closings, entries, persons, accounts, categories, "EUR");
        const mobility = c.categories.find((x) => x.category.id === transport.id)!;
        expect(mobility.planned).toBe(120); // without the ticket
        expect(mobility.deviation).toBe(30);
    });

    it("cannot compare a pot without balances of the previous month", () => {
        const closings = [closing("2026-10", {balances: [{account_id: joint.id, balance: 5700}]})];
        const c = compareMonth(oct, closings, entries, persons, accounts, categories, "EUR");
        expect(c.pots.find((p) => p.pot === "household")!.deviation).toBeUndefined();
    });
});

describe("variableCostsYear", () => {
    it("suggests a budget weighted towards the last three months and shows the trend", () => {
        // groceries: 400 for six months, then 500 for three months
        const amounts = [400, 400, 400, 400, 400, 400, 500, 500, 500];
        const closings = amounts.map((amount, i) =>
            closing(dayjs("2026-02-01").add(i, "month").format("YYYY-MM"), {actuals: [{category_id: groceries.id, amount}]}));
        const year = variableCostsYear(oct, closings, [expense(450, {is_variable: true, category_id: groceries.id})],
            persons, accounts, categories, "EUR");
        const food = year.categories[0];
        expect(food.months).toBe(9);
        expect(food.average).toBeCloseTo(433.33, 1);
        expect(food.trend).toBeCloseTo(0.25);
        // weighted: (6 × 400 + 3 × 2 × 500) / 12 = 450, rounded up to 10
        expect(food.recommendation).toBe(450);
        expect(year.trackedMonths).toBe(9);
    });
});
