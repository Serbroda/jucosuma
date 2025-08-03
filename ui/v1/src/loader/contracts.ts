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
    const res = await fetch(`${apiBasePath}/contracts/${params.id}`);
    if (!res.ok) {
        throw new Response(res.statusText, {status: res.status});
    }

    const contract = await res.json();
    if (!contract) {
        throw new Response("Not Found", {status: 404});
    }
    return {contract: contract};
}

export {contractsLoader, contractLoader};