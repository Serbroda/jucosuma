import {apiBasePath} from "../config.ts";
import {apiFetch} from "./fetch.ts";

/** Sends JSON to the API; resolves to an error message or null on success. */
export async function sendJson(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<string | null> {
    const res = await apiFetch(`${apiBasePath}${path}`, {
        method,
        headers: body !== undefined ? {"Content-Type": "application/json"} : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return null;
    const text = await res.text();
    try {
        return JSON.parse(text).message ?? text;
    } catch {
        return text || res.statusText;
    }
}
