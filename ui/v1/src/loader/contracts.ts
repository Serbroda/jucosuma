import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {withAutoColors} from "../utils/household.utils.ts";

async function fetchJSON(url: string) {
    const res = await apiFetch(url);
    if (res.status === 401) {
        window.location.hash = '#/login';
        throw new Response('Unauthorized', {status: 401});
    }
    if (!res.ok) {
        throw new Response(res.statusText, {status: res.status});
    }
    return await res.json();
}

async function contractHoldersLoader() {
    const res = await fetchJSON(`${apiBasePath}/contract_holders`);
    if (!res) {
        throw new Response("Not Found", {status: 404});
    }
    return {holders: res};
}

async function companiesLoader() {
    const res = await fetchJSON(`${apiBasePath}/companies`);
    return {companies: res ?? []};
}

async function categoriesLoader() {
    const res = await fetchJSON(`${apiBasePath}/categories`);
    return {categories: withAutoColors(res ?? [])};
}

async function householdLoader() {
    const [persons, accounts, {categories}, goals, closings, contacts] = await Promise.all([
        fetchJSON(`${apiBasePath}/persons`),
        fetchJSON(`${apiBasePath}/accounts`),
        categoriesLoader(),
        fetchJSON(`${apiBasePath}/savings_goals`),
        fetchJSON(`${apiBasePath}/month_closings`),
        fetchJSON(`${apiBasePath}/contacts`),
    ]);
    return {persons: persons ?? [], accounts: accounts ?? [], categories, goals: goals ?? [], closings: closings ?? [], contacts: contacts ?? []};
}

/** Everything the household pages need: entries, persons, accounts, categories and goals. */
async function contractsLoader() {
    const [contracts, {holders}, household] = await Promise.all([
        fetchJSON(`${apiBasePath}/contracts`),
        contractHoldersLoader(),
        householdLoader(),
    ]);
    if (!contracts) {
        throw new Response("Not Found", {status: 404});
    }
    return {contracts, holders, ...household};
}

async function contractLoader({params}: { params: any }) {
    const [contract, {holders}, {companies}, household] = await Promise.all([
        fetchJSON(`${apiBasePath}/contracts/${params.id}`),
        contractHoldersLoader(),
        companiesLoader(),
        householdLoader(),
    ]);
    if (!contract) {
        throw new Response("Not Found", {status: 404});
    }
    return {contract, holders, companies, ...household};
}

async function contractFormLoader() {
    const [{holders}, {companies}, household] = await Promise.all([
        contractHoldersLoader(),
        companiesLoader(),
        householdLoader(),
    ]);
    return {holders, companies, ...household};
}

export {contractsLoader, contractLoader, contractHoldersLoader, categoriesLoader, contractFormLoader, householdLoader};