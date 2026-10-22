import {describe, expect, it} from "vitest";
import {sortItems} from "./sort.utils.ts";

describe("sortItems", () => {
    it("sorts numbers and keeps empty values last in both directions", () => {
        const rows = [{v: 5}, {v: undefined}, {v: 12}, {v: 0}];
        expect(sortItems(rows, (r) => r.v, "desc").map((r) => r.v)).toEqual([12, 5, 0, undefined]);
        expect(sortItems(rows, (r) => r.v, "asc").map((r) => r.v)).toEqual([0, 5, 12, undefined]);
    });

    it("sorts texts naturally, ignoring case and with umlauts in place", () => {
        const names = ["Zahnarzt", "Ärztekammer", "auto 10", "Auto 2", ""];
        expect(sortItems(names, (n) => n, "asc")).toEqual(["Ärztekammer", "Auto 2", "auto 10", "Zahnarzt", ""]);
    });

    it("does not change the original order", () => {
        const rows = [3, 1, 2];
        sortItems(rows, (r) => r, "asc");
        expect(rows).toEqual([3, 1, 2]);
    });
});
