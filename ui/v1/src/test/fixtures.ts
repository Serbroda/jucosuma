import {
    AccountTypeChecking,
    AccountTypeSavings,
    BillingPeriodMonthly,
    EntryKindExpense,
    EntryKindIncome,
    EntryKindTransfer,
    GoalKindSaving,
    type AccountDto,
    type CategoryDto,
    type ContractDto,
    type MonthClosingDto,
    type PersonDto,
    type SavingsGoalDto,
} from "../gen/types.gen.ts";

/** A household of Danny and Julia with a joint account, private accounts and a savings account. */
export const danny: PersonDto = {id: 1, name: "Danny", in_household: true, sort_order: 0};
export const julia: PersonDto = {id: 2, name: "Julia", in_household: true, sort_order: 1};
export const friends: PersonDto = {id: 3, name: "Friends", in_household: false, sort_order: 2};
export const persons = [danny, julia, friends];

export const joint: AccountDto = {id: 10, name: "Joint", type: AccountTypeChecking, sort_order: 0, is_savings: false};
export const dannyAccount: AccountDto = {id: 11, name: "Danny", type: AccountTypeChecking, person_id: 1, sort_order: 1, is_savings: false};
export const juliaAccount: AccountDto = {id: 12, name: "Julia", type: AccountTypeChecking, person_id: 2, sort_order: 2, is_savings: false};
export const savings: AccountDto = {id: 13, name: "Savings", type: AccountTypeSavings, sort_order: 3, is_savings: true};
export const accounts = [joint, dannyAccount, juliaAccount, savings];

export function category(id: number, key: string, name = key): CategoryDto {
    return {id, key, name, type: EntryKindExpense, sort_order: id};
}

export const groceries = category(100, "groceries");
export const transport = category(101, "transport");
export const insurance = category(102, "insurance");
export const categories = [groceries, transport, insurance];

let nextId = 1000;

/** An entry with sensible defaults: monthly, since 2026-01-01, EUR, no shares. */
export function entry(fields: Partial<ContractDto>): ContractDto {
    return {
        id: nextId++, name: "entry", category: "", is_contract: false, is_variable: false,
        start_date: "2026-01-01", billing_period: BillingPeriodMonthly, costs: 0, currency: "EUR",
        status: "active", split_between: 1, kind: EntryKindExpense, shares: [], household_share: 1,
        amounts: [], links: [], documents: [],
        ...fields,
    } as ContractDto;
}

export const expense = (costs: number, fields: Partial<ContractDto> = {}) => entry({kind: EntryKindExpense, costs, ...fields});
export const income = (costs: number, fields: Partial<ContractDto> = {}) => entry({kind: EntryKindIncome, costs, ...fields});
export const transfer = (costs: number, from: AccountDto, to: AccountDto, fields: Partial<ContractDto> = {}) =>
    entry({kind: EntryKindTransfer, costs, account_id: from.id, target_account_id: to.id, ...fields});

export function goal(fields: Partial<SavingsGoalDto>): SavingsGoalDto {
    return {id: 7, name: "Goal", kind: GoalKindSaving, sort_order: 0, ...fields};
}

export function closing(month: string, fields: Partial<MonthClosingDto> = {}): MonthClosingDto {
    return {id: nextId++, month, balances: [], actuals: [], ...fields};
}
