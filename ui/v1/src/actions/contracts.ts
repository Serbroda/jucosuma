// src/actions/contractAction.ts
import type {ActionFunction} from "react-router";
import type {ContractDto} from "../gen/types.gen";
import {apiBasePath} from "../config.ts";

export const contractAction: ActionFunction = async ({request, params}) => {
    // 1) alle FormData-Felder vom <Form encType="multipart/form-data"> abholen
    const form = await request.formData();

    // 2) Meta-Objekt bauen
    const meta: Partial<ContractDto> = {
        name: form.get("name") as string,
        company: form.get("company") as string || undefined,
        contract_type: form.get("contract_type") as string,
        category: form.get("category") as string,
        start_date: form.get("start_date") as string,
        end_date: form.get("end_date") as string || undefined,
        contract_number: form.get("contract_number") as string || undefined,
        customer_number: form.get("customer_number") as string || undefined,
        costs: parseFloat(form.get("costs") as string) || undefined,
        billing_period: form.get("billing_period") as string,
        icon_source: form.get("icon_source") as string || undefined,
        notes: form.get("notes") as string || undefined,
    };

    // 3) Neues FormData für den Backend-Request
    const fd = new FormData();
    fd.append("meta", JSON.stringify(meta));

    // 4) Datei-Feld hinzufügen (input name="file")
    const file = form.get("file");
    if (file instanceof File) {
        fd.append("file", file, file.name);
    }

    // 5) URL & Methode ermitteln
    const id = params.id;
    const method = id ? "PUT" : "POST";
    const url = id
        ? `${apiBasePath}/contracts/${id}`
        : `${apiBasePath}/contracts`;

    // 6) An den Go-Server senden
    const res = await fetch(url, {
        method,
        // Kein Content-Type-Header! Browser fügt multipart/form-data + Boundary hinzu
        body: fd,
    });

    if (!res.ok) {
        // Fehler zurückgeben, damit react-router dich zum errorElement routet
        return new Response(await res.text(), {
            status: res.status,
            headers: {"Content-Type": "application/json"},
        });
    }

    const c = await res.json()

    // Auf Erfolg weiterleiten
    return new Response(null, {
        status: 303,
        headers: {Location: id ? `/contracts/${id}` : `/contracts/${c.id}`},
    });
};