import {describe, expect, it} from "vitest";
import {BillingPeriodOneTime, EntryKindIncome, type BankTransactionDto, type CategoryDto} from "../gen/types.gen.ts";
import {bankTargets, isTarget, selectedTargetValue, targetChange} from "./bank.utils.ts";
import {category, expense, groceries, insurance, transport} from "../test/fixtures.ts";

const salary: CategoryDto = {...category(200, "salary"), type: EntryKindIncome};
const categories = [transport, groceries, insurance, salary];

function booking(amount: number, fields: Partial<BankTransactionDto> = {}): BankTransactionDto {
    return {
        id: 1, import_id: 1, account_id: 10, booking_date: "2026-10-12", value_date: "2026-10-12", counterparty: "REWE",
        booking_text: "Lastschrift", purpose: "", amount, currency: "EUR", scope: "HOUSEHOLD", ...fields,
    } as BankTransactionDto;
}

describe("bankTargets", () => {
    const food = expense(600, {name: "Lebensmittel", is_variable: true, category_id: groceries.id});
    const fuel = expense(120, {name: "Tanken", is_variable: true, category_id: transport.id, end_date: "2026-09-30"});
    const rent = expense(1000, {name: "Miete", category_id: insurance.id});
    const washer = expense(500, {name: "Waschmaschine", is_variable: true, category_id: insurance.id,
        billing_period: BillingPeriodOneTime, start_date: "2026-09-20"});
    const entries = [rent, fuel, food, washer];

    it("offers running variable costs, then expense categories, in a fixed order", () => {
        const groups = bankTargets(booking(-12), entries, categories, false);
        expect(groups.map((g) => g.key)).toEqual(["variable", "expense"]);
        // fuel ended, rent is fixed, the washing machine was a one-off in September
        expect(groups[0].targets.map((t) => t.label)).toEqual(["Lebensmittel"]);
        expect(bankTargets(booking(-500, {booking_date: "2026-09-22"}), entries, categories, false)[0].targets.map((t) => t.label))
            .toEqual(["Lebensmittel", "Tanken", "Waschmaschine"]);
        const labels = groups[1].targets.map((t) => t.label);
        expect(labels).toHaveLength(3);
        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
        // the order does not depend on what was chosen before
        expect(bankTargets(booking(-30, {category_id: transport.id}), entries, categories, false)).toEqual(groups);
    });

    it("offers income categories for money coming in, the expense side only on request", () => {
        expect(bankTargets(booking(78), entries, categories, false).map((g) => g.key)).toEqual(["income"]);
        expect(bankTargets(booking(78), entries, categories, true).map((g) => g.key)).toEqual(["income", "variable", "expense"]);
    });

    it("tells an entry apart from its category", () => {
        const [variable, expenses] = bankTargets(booking(-12), entries, categories, false);
        const linked = booking(-12, {contract_id: food.id, category_id: groceries.id});
        expect(isTarget(linked, variable.targets[0])).toBe(true);
        expect(isTarget(linked, expenses.targets.find((t) => t.id === groceries.id)!)).toBe(false);
        expect(selectedTargetValue(linked)).toBe(`e:${food.id}`);
        expect(targetChange(`e:${food.id}`)).toEqual({contract_id: food.id});
        expect(targetChange("c:101")).toEqual({category_id: 101});
        expect(targetChange("")).toEqual({clear_category: true});
    });
});
