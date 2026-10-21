import {useLoaderData} from "react-router";
import type {
    AccountDto,
    CategoryDto,
    ContractDto,
    PersonDto,
    SavingsGoalDto,
} from "../gen/types.gen.ts";

export type AppData = {
    contracts: ContractDto[];
    persons: PersonDto[];
    accounts: AccountDto[];
    categories: CategoryDto[];
    goals: SavingsGoalDto[];
};

/** Typed access to the data loaded by `contractsLoader`. */
export function useAppData(): AppData {
    return useLoaderData() as AppData;
}
