import {create} from 'zustand';

export type Theme = "dark" | "light";

export type PreferencesState = {
    theme: string;
    init: () => void;
    setTheme: (theme: Theme) => void;
}


const applyTheme = (theme: Theme) => {
    const docEl = document.documentElement;
    docEl.removeAttribute('data-theme');
    docEl.setAttribute('data-theme', theme);
}

export const usePreferences = create<PreferencesState>((set) => ({
    theme: "light" as Theme,
    init: () => {
        let theme: Theme | null = null;
        if (localStorage.theme === "dark" || !("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark").matches) {
            theme = "dark"
        } else {
            theme = "light"
        }
        applyTheme(theme);
        set({theme})
    },
    setTheme: (theme: Theme) => {
        localStorage.setItem("theme", theme);
        applyTheme(theme);
        set({theme});
    }
}))