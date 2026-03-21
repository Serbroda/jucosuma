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
    const contract = await fetchJSON(`${apiBasePath}/contracts/${params.id}`);
    if (!contract) {
        throw new Response("Not Found", {status: 404});
    }

    const contractHolders = await contractHoldersLoader();
    return {contract: contract, holders: contractHolders.holders};
}

export {contractsLoader, contractLoader, contractHoldersLoader};