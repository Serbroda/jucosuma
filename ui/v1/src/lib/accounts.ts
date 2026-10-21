import type {AccountDto} from "../gen/types.gen.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "./fetch.ts";

const jsonHeaders = {'Content-Type': 'application/json'};

/** Saves an account; all fields are sent so savings data maintained elsewhere is kept. */
export async function saveAccount(account: Partial<AccountDto>): Promise<Response> {
    return apiFetch(account.id ? `${apiBasePath}/accounts/${account.id}` : `${apiBasePath}/accounts`, {
        method: account.id ? 'PUT' : 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
            name: account.name,
            type: account.type,
            person_id: account.person_id ?? null,
            sort_order: account.sort_order ?? 0,
            is_savings: account.is_savings ?? null,
            balance: account.balance ?? null,
            balance_date: account.balance_date || null,
            goal_amount: account.goal_amount ?? null,
            goal_date: account.goal_date || null,
        }),
    });
}
