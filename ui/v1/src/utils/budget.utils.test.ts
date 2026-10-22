import {describe, expect, it} from "vitest";
import dayjs from "../lib/dayjs";
import {BillingPeriodAnnually, BillingPeriodOneTime} from "../gen/types.gen.ts";
import {amountInMonth, costOwner, summarizeGoals, summarizeMonth} from "./budget.utils.ts";
import {
    accounts, danny, dannyAccount, expense, friends, goal, groceries, income, joint, julia, juliaAccount, persons,
    savings, transfer,
} from "../test/fixtures.ts";

const oct = dayjs("2026-10-01");
const summarize = (entries: Parameters<typeof summarizeMonth>[0], scope: Parameters<typeof summarizeMonth>[6] = "all") =>
    summarizeMonth(entries, persons, accounts, oct, "average", "EUR", scope);

describe("amountInMonth", () => {
    it("spreads yearly amounts in average mode and books them in their month in due mode", () => {
        const insurance = expense(120, {billing_period: BillingPeriodAnnually, start_date: "2026-03-15"});
        expect(amountInMonth(insurance, oct, "average")).toBe(10);
        expect(amountInMonth(insurance, oct, "due")).toBe(0);
        expect(amountInMonth(insurance, dayjs("2027-03-01"), "due")).toBe(120);
    });

    it("counts one-off entries only in their month", () => {
        const purchase = expense(500, {billing_period: BillingPeriodOneTime, start_date: "2026-10-20"});
        expect(amountInMonth(purchase, oct, "average")).toBe(500);
        expect(amountInMonth(purchase, dayjs("2026-11-01"), "average")).toBe(0);
    });

    it("respects start and end date", () => {
        const rent = expense(900, {start_date: "2026-11-01", end_date: "2027-02-28"});
        expect(amountInMonth(rent, oct, "average")).toBe(0);
        expect(amountInMonth(rent, dayjs("2027-02-01"), "average")).toBe(900);
        expect(amountInMonth(rent, dayjs("2027-03-01"), "average")).toBe(0);
    });

    it("uses the amount valid in the month (amount history)", () => {
        const food = expense(450, {
            base_costs: 350,
            amounts: [{id: 1, valid_from: "2026-05-15", costs: 400}, {id: 2, valid_from: "2027-01-01", costs: 450}],
        });
        expect(amountInMonth(food, dayjs("2026-04-01"), "average")).toBe(350);
        expect(amountInMonth(food, dayjs("2026-05-01"), "average")).toBe(400); // change within May counts for May
        expect(amountInMonth(food, oct, "due")).toBe(400);
        expect(amountInMonth(food, dayjs("2027-01-01"), "average")).toBe(450);
    });
});

describe("summarizeMonth – pots", () => {
    const entries = [
        income(4000, {account_id: dannyAccount.id}),
        income(3000, {account_id: juliaAccount.id}),
        transfer(1500, dannyAccount, joint),
        transfer(1000, juliaAccount, joint),
        expense(1400, {account_id: joint.id}),
        expense(50, {account_id: dannyAccount.id}),
    ];

    it("books money in the pot of its account", () => {
        const household = summarize(entries, "household");
        expect(household.income).toBe(0);
        expect(household.transfersIn).toBe(2500);
        expect(household.expenses).toBe(1400);
        expect(household.available).toBe(1100);

        const d = summarize(entries, danny.id);
        expect(d.income).toBe(4000);
        expect(d.transfersOut).toBe(1500);
        expect(d.expenses).toBe(50);
        expect(d.available).toBe(2450);
    });

    it("treats transfers between pots as internal in the total and adds up", () => {
        const all = summarize(entries);
        expect(all.transfersIn).toBe(0);
        expect(all.transfersOut).toBe(0);
        expect(all.available).toBe(7000 - 1450);
        const parts = ["household", danny.id, julia.id] as const;
        const sum = parts.reduce<number>((s, p) => s + summarize(entries, p).available, 0);
        expect(sum).toBeCloseTo(all.available);
    });

    it("leaves out the share of external persons", () => {
        // family plan 18 €, paid by Julia, Julia 1 part, friends 2 parts
        const plan = expense(18, {
            account_id: juliaAccount.id, household_share: 1 / 3,
            shares: [{person_id: julia.id, weight: 1}, {person_id: friends.id, weight: 2}],
        });
        const s = summarize([plan], julia.id);
        expect(s.expenses).toBeCloseTo(6);
        expect(s.externalShare).toBeCloseTo(12);
    });

    it("counts transfers to savings accounts as savings and spending from savings against them", () => {
        const s = summarize([
            transfer(300, joint, savings),
            expense(100, {account_id: savings.id}),
        ]);
        expect(s.savings).toBe(200);
        expect(s.fromSavings).toBe(100);
    });

    it("splits costs into fixed and variable", () => {
        const s = summarize([
            expense(600, {account_id: joint.id, is_variable: true, category_id: groceries.id, category: "groceries"}),
            expense(900, {account_id: joint.id, is_contract: true}),
            expense(30, {account_id: joint.id, category_id: groceries.id, category: "groceries"}),
        ]);
        expect(s.expenses).toBe(1530);
        expect(s.variableCosts).toBe(600);
        const food = s.byCategory.find((c) => c.id === groceries.id)!;
        expect(food.amount).toBe(630);
        expect(food.variable).toBe(600);
    });
});

describe("costOwner", () => {
    it("follows the account without explicit shares", () => {
        expect(costOwner(expense(10, {account_id: dannyAccount.id}), persons, accounts)).toBe(danny.id);
        expect(costOwner(expense(10, {account_id: joint.id}), persons, accounts)).toBe("household");
    });

    it("uses explicit shares, external persons do not make it shared", () => {
        const both = expense(10, {account_id: dannyAccount.id, shares: [{person_id: 1, weight: 1}, {person_id: 2, weight: 1}]});
        expect(costOwner(both, persons, accounts)).toBe("household");
        const withFriends = expense(10, {shares: [{person_id: 2, weight: 1}, {person_id: 3, weight: 2}]});
        expect(costOwner(withFriends, persons, accounts)).toBe(julia.id);
    });
});

describe("summarizeGoals", () => {
    it("estimates and projects month by month with the amount history", () => {
        const rate = transfer(400, joint, savings, {
            goal_id: 7, base_costs: 300,
            amounts: [{id: 1, valid_from: "2026-06-01", costs: 400}, {id: 2, valid_from: "2027-01-01", costs: 500}],
        });
        const [g] = summarizeGoals([rate], [goal({current_amount: 1000, current_date: "2026-03-01", target_amount: 10000})], dayjs("2026-10-22"));
        expect(g.monthlyRate).toBe(400);
        expect(g.current).toBe(1000 + 3 * 300 + 4 * 400); // March–May 300, June–September 400
        expect(g.reachedOn?.format("YYYY-MM")).toBe("2027-12");
    });
});
