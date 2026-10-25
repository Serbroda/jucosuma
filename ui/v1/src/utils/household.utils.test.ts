import {describe, expect, it} from "vitest";
import {EntryKindIncome} from "../gen/types.gen.ts";
import {defaultCostType, entryContact, sharesForAccount, withAutoColors} from "./household.utils.ts";
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
});

describe("withAutoColors", () => {
    it("gives uncoloured categories a free slot and keeps catch-alls grey", () => {
        const coloured = {...category(1, "housing"), color: 1};
        const result = withAutoColors([coloured, {...category(2, "pets"), color: 2}, category(3, "custom"), category(4, "other")]);
        expect(result.map((c) => c.color)).toEqual([1, 2, 3, undefined]);
    });

    it("counts slots per entry type", () => {
        const income = {...category(5, "salary"), type: EntryKindIncome, color: 1};
        expect(withAutoColors([income, category(6, "custom")])[1].color).toBe(1);
    });
});

describe("entryContact", () => {
    const lvm = {id: 1, name: "LVM", phone: "0251 1", website: "https://lvm.de", contact_person: "Herr Müller"};

    it("prefers the entry's own data and falls back to the contact", () => {
        const result = entryContact({contact_id: 1, contact_phone: "0251 999", website: " "}, [lvm]);
        expect(result).toMatchObject({contact: lvm, phone: "0251 999", website: "https://lvm.de", person: "Herr Müller"});
    });

    it("works without a contact", () => {
        expect(entryContact({website: "https://x.de"}, [lvm])).toEqual({
            contact: undefined, website: "https://x.de", person: undefined, address: undefined, phone: undefined, email: undefined,
        });
    });
});
