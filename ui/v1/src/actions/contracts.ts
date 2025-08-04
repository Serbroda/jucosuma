// src/actions/contractAction.ts
import type {ActionFunction} from "react-router";
import type {ContractDto} from "../gen/types.gen";
import {apiBasePath} from "../config.ts";

export const contractAction: ActionFunction = async ({request, params}) => {
    const formData = await request.formData();         // get form data  [oai_citation:3‡GitHub](https://github.com/remix-run/react-router/discussions/12587?utm_source=chatgpt.com)
    const payload = {
        name: formData.get("name"),
        company: formData.get("company"),
        category: formData.get("category"),
        contract_type:  formData.get("contract_type"),
        start_date:  formData.get("start_date"),
        end_date:  formData.get("end_date"),
        contract_number:  formData.get("contract_number"),
        customer_number:  formData.get("customer_number"),
        costs: parseFloat(formData.get("costs") as string) || 0,
        billing_period:  formData.get("billing_period"),
        icon_source:  formData.get("icon_source"),
        notes:  formData.get("notes"),
    } as Partial<ContractDto>;

    console.log(payload)

    const id = params.id;
    const method = id ? "PUT" : "POST";                 // determine method
    const url = id
        ? `${apiBasePath}/contracts/${id}`
        : `${apiBasePath}/contracts`;

    const res = await fetch(url, {
        method,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        // Return a Response that React Router will treat as an error
        return new Response(await res.text(), {
            status: res.status,
            headers: {"Content-Type": "application/json"},
        });
    }

    // On success, you can still redirect
    return new Response(null, {
        status: 303,
        headers: {Location: `/contracts/${params.id}`},
    });
};