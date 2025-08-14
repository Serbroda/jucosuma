import {apiBasePath} from "../config.ts";

async function contractsLoader() {
    const res = await fetch(`${apiBasePath}/contracts`);
    if (!res.ok) {
        throw new Response(res.statusText, {status: res.status});
    }

    const contracts = await res.json();
    if (!contracts) {
        throw new Response("Not Found", {status: 404});
    }
    return {contracts: contracts};
}

async function contractLoader({params}: { params: any }) {
    let res = await fetch(`${apiBasePath}/contracts/${params.id}`);
    if (!res.ok) {
        throw new Response(res.statusText, {status: res.status});
    }

    const contract = await res.json();
    if (!contract) {
        throw new Response("Not Found", {status: 404});
    }

    res = await fetch(`${apiBasePath}/contract_holders`);
    if (!res.ok) {
        throw new Response(res.statusText, {status: res.status});
    }

    const holders = await res.json();
    if (!holders) {
        throw new Response("Not Found", {status: 404});
    }

    return {contract: contract, holders: holders};
}

export {contractsLoader, contractLoader};