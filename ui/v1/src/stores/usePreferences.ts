import {create} from 'zustand';

export type Theme = "dark" | "light";

export type PreferencesState = {
    theme: string;
    mainCurrency: string;
    init: () => void;
    setTheme: (theme: Theme) => void;
    setMainCurrency: (currency: string) => void;
}


const applyTheme = (theme: Theme) => {
    const docEl = document.documentElement;
    docEl.removeAttribute('data-theme');
    docEl.setAttribute('data-theme', theme);
}

export const usePreferences = create<PreferencesState>((set) => ({
    theme: "light" as Theme,
    mainCurrency: "EUR",
    init: () => {
        let theme: Theme | null = null;
        if (localStorage.theme === "dark" || !("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark").matches) {
            theme = "dark"
        } else {
            theme = "light"
        }
        applyTheme(theme);
        const mainCurrency = localStorage.getItem("mainCurrency") || "EUR";
        set({theme, mainCurrency})
    },
    setTheme: (theme: Theme) => {
        localStorage.setItem("theme", theme);
        applyTheme(theme);
        set({theme});
    },
    setMainCurrency: (currency: string) => {
        localStorage.setItem("mainCurrency", currency);
        set({mainCurrency: currency});
    },
}))