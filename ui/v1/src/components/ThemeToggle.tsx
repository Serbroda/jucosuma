import {usePreferences} from "../stores/usePreferences.ts";
import {useEffect, useState} from "react";
import Swap from "./Swap.tsx";
import {MoonIcon, SunIcon} from "@heroicons/react/16/solid";

export default function ThemeToggle() {
    const {theme, setTheme} = usePreferences();
    const [darkMode, setDarkMode] = useState(theme === "dark");

    useEffect(() => {
        setDarkMode(theme === "dark");
    }, [theme]);

    return (
        <div className="fixed top-4 right-4 z-50">
            <Swap
                isActive={darkMode}
                activeNode={<SunIcon className="size-5 hover:opacity-75 text-zinc-400"/>}
                inactiveNode={<MoonIcon className="size-5 hover:opacity-75 text-zinc-600"/>}
                onChange={(val) => {
                    setTheme(val ? "dark" : "light");
                    setDarkMode(val);
                }}
                className="hover:cursor-pointer transition duration-300 ease-in-out"
            />
        </div>
    );
}
