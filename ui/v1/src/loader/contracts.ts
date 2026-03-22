import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";

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
    return {categories: res ?? []};
}

async function contractsLoader() {
    const [contracts, {holders}] = await Promise.all([
        fetchJSON(`${apiBasePath}/contracts`),
        contractHoldersLoader(),
    ]);
    if (!contracts) {
        throw new Response("Not Found", {status: 404});
    }
    return {contracts, holders};
}

async function contractLoader({params}: { params: any }) {
    const [contract, {holders}, {companies}, {categories}] = await Promise.all([
        fetchJSON(`${apiBasePath}/contracts/${params.id}`),
        contractHoldersLoader(),
        companiesLoader(),
        categoriesLoader(),
    ]);
    if (!contract) {
        throw new Response("Not Found", {status: 404});
    }
    return {contract, holders, companies, categories};
}

async function contractFormLoader() {
    const [{holders}, {companies}, {categories}] = await Promise.all([
        contractHoldersLoader(),
        companiesLoader(),
        categoriesLoader(),
    ]);
    return {holders, companies, categories};
}

export {contractsLoader, contractLoader, contractHoldersLoader, categoriesLoader, contractFormLoader};