import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {ChartPieIcon, ShieldCheckIcon, UserGroupIcon} from "@heroicons/react/20/solid";
import ThemeToggle from "./ThemeToggle.tsx";
import logo from "../assets/logo.svg";

/** Layout for login and password change: brand panel (desktop) and a form card. */
export default function AuthShell({title, subtitle, error, children}: {
    title: string;
    subtitle?: string;
    error?: string;
    children: ReactNode;
}) {
    const {t} = useTranslation();
    const features = [
        {icon: ChartPieIcon, text: t('auth.featureOverview')},
        {icon: UserGroupIcon, text: t('auth.featureShared')},
        {icon: ShieldCheckIcon, text: t('auth.featureContracts')},
    ];

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-zinc-50 dark:bg-zinc-950">
            <ThemeToggle/>

            {/* Brand panel */}
            <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white">
                <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 size-[32rem] rounded-full opacity-30 blur-3xl"
                     style={{background: "radial-gradient(circle, #2a78d6, transparent 70%)"}}/>
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 size-[28rem] rounded-full opacity-25 blur-3xl"
                     style={{background: "radial-gradient(circle, #1baf7a, transparent 70%)"}}/>

                <div className="relative flex items-center gap-3">
                    <img src={logo} alt="" className="size-11 invert"/>
                    <span className="text-xl font-semibold">Jucosuma</span>
                </div>

                <div className="relative max-w-md">
                    <img src={logo} alt="" className="size-40 invert opacity-90 mb-10"/>
                    <h2 className="text-3xl font-semibold leading-tight">{t('auth.tagline')}</h2>
                    <ul className="mt-8 flex flex-col gap-4">
                        {features.map(({icon: Icon, text}) => (
                            <li key={text} className="flex items-center gap-3 text-zinc-300">
                                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                                    <Icon className="size-4 text-white"/>
                                </span>
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="relative text-xs text-zinc-500 font-mono">v{__APP_VERSION__}</div>
            </div>

            {/* Form */}
            <div className="flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm">
                    <div className="flex flex-col items-center text-center mb-8 lg:hidden">
                        <img src={logo} alt="" className="size-20 dark:invert"/>
                        <span className="mt-3 text-xl font-semibold text-zinc-950 dark:text-white">Jucosuma</span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('auth.taglineShort')}</span>
                    </div>

                    <div className="rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10">
                        <h1 className="text-xl font-semibold text-zinc-950 dark:text-white">{title}</h1>
                        {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}

                        {error && (
                            <div role="alert" className="mt-5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="mt-6">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
