import {StackedLayout} from "../components/catalyst/stacked-layout.tsx";
import {
    Navbar,
    NavbarDivider,
    NavbarItem,
    NavbarLabel,
    NavbarSection,
    NavbarSpacer
} from "../components/catalyst/navbar.tsx";
import {Sidebar, SidebarBody, SidebarHeader, SidebarItem, SidebarSection} from "../components/catalyst/sidebar.tsx";
import {href, NavLink, Outlet} from "react-router";
import {Avatar} from "../components/catalyst/avatar.tsx";

import logo from '../assets/logo.svg'
import githubLogo from '../assets/github.svg'
import {usePreferences} from "../stores/usePreferences.ts";
import {useEffect, useState} from "react";
import Swap from "../components/Swap.tsx";
import {MoonIcon, SunIcon} from "@heroicons/react/16/solid";

const navItems = [
    {label: 'Contracts', url: '/'},
    /* {label: 'Persons', url: '/persons'},
     {label: 'Settings', url: '/settings'},*/
]

function MainLayout() {
    const {theme, setTheme} = usePreferences()
    const [darkMode, setDarkMode] = useState<boolean>(theme == "dark")

    useEffect(() => {
        setDarkMode(theme == "dark")
    }, [theme])

    return (
        <div className="text-black dark:text-white">
            <StackedLayout
                navbar={
                    <Navbar>
                        <NavbarSection className="max-lg:hidden">
                            <div className="flex gap-x-2 m-2">
                                <Avatar
                                    src={logo}
                                    square
                                    className="!size-10 pr-2 outline-0 dark:invert"
                                />

                                <div className="flex flex-col">
                                    <NavLink to="/" className="text-lg font-bold">Jucosuma</NavLink>
                                    <a href="https://github.com/Serbroda/jucosuma/releases"
                                       target="_blank"
                                       className="text-2xs text-zinc-500 dark:text-zinc-400 hover:underline"
                                    >
                                        <small>
                                            <pre>v{__APP_VERSION__}</pre>
                                        </small>
                                    </a>
                                </div>
                            </div>
                        </NavbarSection>
                        <NavbarDivider className="max-lg:hidden"/>
                        <NavbarSection className="max-lg:hidden">
                            {navItems.map(({label, url}) => (
                                <NavbarItem key={label} href={url}>
                                    {label}
                                </NavbarItem>
                            ))}
                        </NavbarSection>
                        <NavbarSpacer/>
                        <NavbarSection className="gap-x-6">
                            <a href="https://github.com/Serbroda/jucosuma"
                               target="_blank"
                               className="hidden lg:block hover:opacity-75"
                            >
                                <img
                                    src={githubLogo}
                                    alt="Github"
                                    className="size-5 dark:invert"
                                />
                            </a>
                            <Swap
                                isActive={darkMode}
                                activeNode={<SunIcon className="size-5 hover:opacity-75"/>}
                                inactiveNode={<MoonIcon className="size-5 hover:opacity-75"/>}
                                onChange={(val) => {
                                    setTheme(val ? "dark" : "light")
                                    setDarkMode(val)
                                }}
                                className="hover:cursor-pointer transition duration-300 ease-in-out"
                            />
                        </NavbarSection>
                    </Navbar>
                }
                sidebar={
                    <Sidebar>
                        <SidebarHeader>
                            <SidebarItem>
                                <NavLink to="/" className="flex">
                                    <Avatar
                                        src={logo}
                                        square
                                        className="w-10 h-10 pr-2 outline-0 dark:invert"/>
                                    <NavbarLabel className="flex flex-col">
                                        <b className="text-lg">Jucosuma</b>
                                        <small className="text-2xs text-zinc-500 dark:text-zinc-400">
                                            <pre>v{__APP_VERSION__}</pre>
                                        </small>
                                    </NavbarLabel>
                                </NavLink>
                            </SidebarItem>
                        </SidebarHeader>
                        <SidebarBody>
                            <SidebarSection>
                                {navItems.map(({label, url}) => (
                                    <SidebarItem key={label} href={href(url)}>
                                        {label}
                                    </SidebarItem>
                                ))}
                            </SidebarSection>
                        </SidebarBody>
                    </Sidebar>
                }
            >
                <Outlet/>
            </StackedLayout>
        </div>
    );
}

export default MainLayout
