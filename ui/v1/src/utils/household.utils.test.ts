import {describe, expect, it} from "vitest";
import {defaultCostType, isDefaultAssignment, sharesForAccount} from "./household.utils.ts";
import {accounts, category, dannyAccount, expense, groceries, insurance, joint, persons, transport} from "../test/fixtures.ts";

describe("defaultCostType", () => {
    it("uses the category key for typical categories", () => {
        expect(defaultCostType(groceries)).toBe("variable");
        expect(defaultCostType(insurance)).toBe("contract");
    });

    it("follows most existing entries of other categories", () => {
        const entries = [
            expense(58, {category_id: transport.id}),
            expense(120, {category_id: transport.id, is_variable: true}),
            expense(40, {category_id: transport.id, is_variable: true}),
        ];
        expect(defaultCostType(transport, entries)).toBe("variable");
        expect(defaultCostType(category(999, "custom"))).toBe("fixed");
    });
});

describe("cost assignment", () => {
    it("follows the account: private account → its owner, joint account → household", () => {
        expect(sharesForAccount(dannyAccount.id, accounts, persons)).toEqual([{person_id: 1, weight: 1}]);
        expect(sharesForAccount(joint.id, accounts, persons)).toEqual([{person_id: 1, weight: 1}, {person_id: 2, weight: 1}]);
    });

    it("only reports assignments that differ from the account", () => {
        expect(isDefaultAssignment(expense(10, {account_id: joint.id}), persons, accounts)).toBe(true);
        expect(isDefaultAssignment(expense(10, {account_id: joint.id, shares: [{person_id: 1, weight: 2}, {person_id: 2, weight: 2}]}), persons, accounts)).toBe(true);
        expect(isDefaultAssignment(expense(10, {account_id: joint.id, shares: [{person_id: 1, weight: 1}]}), persons, accounts)).toBe(false);
        expect(isDefaultAssignment(expense(10, {account_id: dannyAccount.id, shares: [{person_id: 1, weight: 1}, {person_id: 3, weight: 1}]}), persons, accounts)).toBe(false);
    });
});
