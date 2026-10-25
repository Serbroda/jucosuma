// src/actions/contractAction.ts
import type {ActionFunction} from "react-router";
import type {ContractDto, ShareDto} from "../gen/types.gen";
import {parseAmount} from "../utils/number.utils.ts";
import i18n from "../i18n";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";

const optionalId = (input: FormDataEntryValue | null): number | undefined =>
    input ? Number(input) : undefined;

const parseShares = (input: FormDataEntryValue | null): ShareDto[] => {
    if (!input) return [];
    try {
        return JSON.parse(input.toString()) as ShareDto[];
    } catch {
        return [];
    }
}

export const contractAction: ActionFunction = async ({request, params}) => {
    // 1) alle FormData-Felder vom <Form encType="multipart/form-data"> abholen
    const form = await request.formData();

    // 2) Meta-Objekt bauen
    const meta: Partial<ContractDto> = {
        name: form.get("name") as string,
        company: form.get("company") as string || undefined,
        category_id: optionalId(form.get("category_id")),
        start_date: form.get("start_date") as string,
        end_date: form.get("end_date") as string || undefined,
        contract_number: form.get("contract_number") as string || undefined,
        customer_number: form.get("customer_number") as string || undefined,
        contract_holder: form.get("contract_holder") as string || undefined,
        costs: parseAmount(form.get("costs")),
        billing_period: form.get("billing_period") as string,
        currency: form.get("currency") as string || undefined,
        next_billing_date: form.get("next_billing_date") as string || undefined,
        contact_person: form.get("contact_person") as string,
        contact_address: form.get("contact_address") as string,
        contact_phone: form.get("contact_phone") as string,
        contact_email: form.get("contact_email") as string,
        website: form.get("website") as string || undefined,
        // only sent by the full form; without the field the existing links are kept
        links: form.has("links") ? JSON.parse(form.get("links") as string) : undefined,
        icon_source: form.get("icon_source") as string || undefined,
        notes: form.get("notes") as string || undefined,
        owner_id: form.get("owner_id") ? Number(form.get("owner_id")) : undefined,
        split_between: Number(form.get("split_between")) || 1,
        kind: form.get("kind") as string || "expense",
        account_id: optionalId(form.get("account_id")),
        target_account_id: optionalId(form.get("target_account_id")),
        goal_id: optionalId(form.get("goal_id")),
        contact_id: optionalId(form.get("contact_id")),
        transfer_type: (form.get("transfer_type") as string) || undefined,
        is_contract: form.get("is_contract") === "true",
        is_variable: form.get("is_variable") === "true",
        term_months: optionalId(form.get("term_months")),
        notice_period: form.get("notice_period") ? Number(form.get("notice_period")) : undefined,
        notice_unit: form.get("notice_period") ? form.get("notice_unit") as string : undefined,
        shares: parseShares(form.get("shares")),
    };

    // 3) Neues FormData für den Backend-Request
    const fd = new FormData();
    fd.append("meta", JSON.stringify(meta));

    // 4) Datei-Feld hinzufügen (input name="file")
    // Hol dir alle Dateien vom Input (nehmen wir 'file' als name)
    const files = form.getAll("file"); // gibt ein Array aller Files zurück

    for (const file of files) {
        if (file instanceof File) {
            fd.append("file", file, file.name); // Key bleibt gleich
        }
    }

    // 5) URL & Methode ermitteln
    const id = params.id;
    const method = id ? "PUT" : "POST";
    const url = id
        ? `${apiBasePath}/contracts/${id}`
        : `${apiBasePath}/contracts`;

    // 6) An den Go-Server senden
    const res = await apiFetch(url, {
        method,
        // Kein Content-Type-Header! Browser fügt multipart/form-data + Boundary hinzu
        body: fd,
    });

    if (!res.ok) {
        const errorText = await res.text();
        let message = i18n.t('entryForm.saveError');
        try {
            const parsed = JSON.parse(errorText);
            message = parsed.message || message;
        } catch {
            if (errorText) message = errorText;
        }
        return {error: message, values: meta};
    }

    // Auf Erfolg weiterleiten
    return new Response(null, {
        status: 303,
        headers: {Location: id ? `/contracts/${id}` : `/entries`},
    });
};