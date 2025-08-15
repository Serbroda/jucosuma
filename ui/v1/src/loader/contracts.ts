import {apiBasePath} from "../config.ts";

async function fetchJSON(url: string) {
    const res = await fetch(url);
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
    const res = await fetchJSON(`${apiBasePath}/contracts`);
    if (!res) {
        throw new Response("Not Found", {status: 404});
    }
    return {contracts: res};
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