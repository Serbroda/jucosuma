// Minimal browser globals used by the i18n setup (language from storage, <html lang>).
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage ??= {getItem: () => "de", setItem: () => undefined, removeItem: () => undefined};
g.document ??= {documentElement: {}};
