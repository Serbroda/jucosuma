import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import dayjs from "../lib/dayjs";
import "dayjs/locale/de";
import en from "./locales/en.ts";
import de from "./locales/de.ts";

export const supportedLanguages = ["en", "de"] as const;
export type Language = (typeof supportedLanguages)[number];

const storageKey = "language";

function isSupported(lang: string | null | undefined): lang is Language {
    return !!lang && (supportedLanguages as readonly string[]).includes(lang);
}

/** Language of the browser, used when the user has not chosen one. */
export function browserLanguage(): Language {
    const lang = navigator.language?.slice(0, 2);
    return isSupported(lang) ? lang : "en";
}

function initialLanguage(): Language {
    let stored: string | null = null;
    try {
        stored = localStorage.getItem(storageKey);
    } catch {
        // storage unavailable
    }
    return isSupported(stored) ? stored : browserLanguage();
}

function apply(lang: Language) {
    dayjs.locale(lang);
    document.documentElement.lang = lang;
}

/**
 * Switches the UI language. `null` means "follow the browser".
 * The resolved language is cached locally so the login page uses it before the user is known.
 */
export async function setLanguage(lang: string | null | undefined) {
    const resolved = isSupported(lang) ? lang : browserLanguage();
    try {
        if (isSupported(lang)) localStorage.setItem(storageKey, lang);
        else localStorage.removeItem(storageKey);
    } catch {
        // storage unavailable
    }
    apply(resolved);
    await i18n.changeLanguage(resolved);
}

const lng = initialLanguage();
apply(lng);

i18n.use(initReactI18next).init({
    resources: {en: {translation: en}, de: {translation: de}},
    lng,
    fallbackLng: "en",
    interpolation: {escapeValue: false},
});

export default i18n;
