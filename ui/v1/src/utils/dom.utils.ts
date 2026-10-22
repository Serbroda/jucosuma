const classNames = (...classes: string[]): string => {
    return classes.join(' ');
}

export { classNames }
/** Only http(s) links are rendered as links (the server validates as well). */
export function safeHref(url: string | null | undefined): string | undefined {
    return url && /^https?:\/\//i.test(url) ? url : undefined;
}

/** Short label of a link: host and path without scheme and trailing slash. */
export function linkLabel(url: string): string {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
