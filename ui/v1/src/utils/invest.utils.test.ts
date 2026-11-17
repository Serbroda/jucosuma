import {describe, expect, it} from "vitest";
import {allocateInvestPlan} from "./invest.utils.ts";
import {InvestModeFixed, InvestModePercent} from "../gen/types.gen.ts";

const percent = (value: number) => ({mode: InvestModePercent, value});
const fixed = (value: number) => ({mode: InvestModeFixed, value});

describe("allocateInvestPlan", () => {
    it("spreads the amount by percentage", () => {
        const plan = allocateInvestPlan(500, [percent(70), percent(20), percent(10)]);
        expect(plan.amounts).toEqual([350, 100, 50]);
        expect(plan.unallocated).toBe(0);
    });

    it("takes fixed amounts first, percentages share the rest", () => {
        const plan = allocateInvestPlan(500, [fixed(100), percent(75), percent(25)]);
        expect(plan.amounts).toEqual([100, 300, 100]);
        expect(plan).toMatchObject({fixed: 100, rest: 400, percent: 100, unallocated: 0});
    });

    it("spreads to the cent when the percentages add up to 100", () => {
        const plan = allocateInvestPlan(100, [percent(33.33), percent(33.33), percent(33.34)]);
        expect(plan.amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
        const thirds = allocateInvestPlan(0.05, [percent(50), percent(50)]);
        expect(thirds.amounts).toEqual([0.03, 0.02]);
        expect(thirds.unallocated).toBe(0);
    });

    it("reports what is left or planned too much", () => {
        expect(allocateInvestPlan(500, [percent(60), percent(30)])).toMatchObject({amounts: [300, 150], percent: 90, unallocated: 50});
        expect(allocateInvestPlan(500, [percent(80), percent(40)])).toMatchObject({amounts: [400, 200], unallocated: -100});
        expect(allocateInvestPlan(500, [fixed(200)])).toMatchObject({amounts: [200], unallocated: 300});
    });

    it("leaves nothing for percentages when fixed amounts exceed the plan", () => {
        const plan = allocateInvestPlan(300, [fixed(250), fixed(100), percent(100)]);
        expect(plan.amounts).toEqual([250, 100, 0]);
        expect(plan).toMatchObject({rest: 0, unallocated: -50});
    });

    it("handles an empty plan", () => {
        expect(allocateInvestPlan(500, [])).toMatchObject({amounts: [], unallocated: 500, percent: 0});
    });
});
