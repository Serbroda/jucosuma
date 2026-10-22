import type {TFunction} from "i18next";
import type {NotificationChannelDto} from "../gen/types.gen.ts";

/** Translation of a key built at runtime (reminder types and channel kinds come from the server). */
export function dynamicLabel(t: TFunction, key: string): string {
    return (t as unknown as (k: string) => string)(key);
}

/** Short description of a channel's target, e.g. "ntfy.sh/haushalt" or the email address. */
export function channelTarget(ch: NotificationChannelDto, defaultNtfy: string): string {
    const cfg = ch.config ?? {};
    if (ch.kind === "ntfy") return `${(cfg.server || defaultNtfy).replace(/^https?:\/\//, "")}/${cfg.topic}`;
    if (ch.kind === "email") return cfg.address ?? "";
    return "";
}
