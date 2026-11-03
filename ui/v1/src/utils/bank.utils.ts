import {
    BillingPeriodOneTime,
    type BankTransactionDto,
    type CategoryDto,
    type ContractDto,
    EntryKindExpense,
    EntryKindIncome,
} from "../gen/types.gen.ts";
import {categoryLabel, sortedByName} from "./household.utils.ts";

/** Where a booking can be assigned to: a planned variable cost (e.g. groceries) or a category. */
export type BankTarget =
    | { type: "entry"; id: number; label: string; hint: string; categoryId: number }
    | { type: "category"; id: number; label: string };

export type BankTargetGroup = { key: "variable" | "expense" | "income"; targets: BankTarget[] };

/** Whether a variable entry applies to a booking: recurring ones while they run, one-off ones (a
 * washing machine) only in their month. */
function appliesOn(c: ContractDto, date: string): boolean {
    if (c.billing_period === BillingPeriodOneTime) return c.start_date.slice(0, 7) === date.slice(0, 7);
    return c.start_date.slice(0, 7) <= date.slice(0, 7) && (!c.end_date || c.end_date >= date);
}

/** Variable cost entries applying to the date of the booking, by name. */
function variableEntries(contracts: ContractDto[], categories: CategoryDto[], date: string): BankTarget[] {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const running = contracts.filter((c) => c.kind === EntryKindExpense && c.is_variable && c.category_id != null
        && appliesOn(c, date));
    return sortedByName(running, (c) => c.name).map((c) => {
        const category = categoryById.get(c.category_id!);
        return {
            type: "entry", id: c.id, label: c.name, categoryId: c.category_id!,
            hint: category ? categoryLabel(category.name, category.key) : "",
        };
    });
}

function categoryTargets(categories: CategoryDto[], kind: string): BankTarget[] {
    return sortedByName(categories.filter((c) => c.type === kind), (c) => categoryLabel(c.name, c.key))
        .map((c) => ({type: "category", id: c.id, label: categoryLabel(c.name, c.key)}));
}

/** Targets in a fixed order. Money going out: variable costs, then expense categories. Money coming in:
 * income categories; with `withExpenses` also the expense side, for refunds (e.g. a utility credit). */
export function bankTargets(tx: BankTransactionDto, contracts: ContractDto[], categories: CategoryDto[], withExpenses: boolean): BankTargetGroup[] {
    const expenseSide: BankTargetGroup[] = [
        {key: "variable", targets: variableEntries(contracts, categories, tx.booking_date)},
        {key: "expense", targets: categoryTargets(categories, EntryKindExpense)},
    ];
    const groups = tx.amount < 0
        ? expenseSide
        : [{key: "income" as const, targets: categoryTargets(categories, EntryKindIncome)}, ...(withExpenses ? expenseSide : [])];
    return groups.filter((g) => g.targets.length > 0);
}

/** Whether a booking is assigned to exactly this target. */
export function isTarget(tx: BankTransactionDto, target: BankTarget): boolean {
    return target.type === "entry"
        ? tx.contract_id === target.id
        : tx.contract_id == null && tx.category_id === target.id;
}

/** Value of a target in a <select>: "e:12" for an entry, "c:3" for a category. */
export function targetValue(target: BankTarget): string {
    return (target.type === "entry" ? "e:" : "c:") + target.id;
}

export function selectedTargetValue(tx: BankTransactionDto): string {
    if (tx.contract_id != null) return "e:" + tx.contract_id;
    return tx.category_id != null ? "c:" + tx.category_id : "";
}

/** Request body for assigning a <select> value ("" clears the category). */
export function targetChange(value: string): { contract_id?: number; category_id?: number; clear_category?: boolean } {
    if (!value) return {clear_category: true};
    const id = Number(value.slice(2));
    return value.startsWith("e:") ? {contract_id: id} : {category_id: id};
}
