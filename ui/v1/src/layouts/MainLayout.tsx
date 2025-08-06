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
import {Switch} from "../components/catalyst/switch.tsx";
import {usePreferences} from "../stores/usePreferences.ts";
import {useEffect, useState} from "react";

const navItems = [
    {label: 'Contracts', url: '/'},
    {label: 'Persons', url: '/persons'},
    {label: 'Settings', url: '/settings'},
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
                            <NavbarItem>
                                <NavLink to="/">
                                    <Avatar
                                        src={logo}
                                        square
                                        className="w-10 h-10 pr-2 outline-0 dark:invert"/>
                                    <NavbarLabel>Jacumbo</NavbarLabel>
                                </NavLink>
                            </NavbarItem>
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
                        <NavbarSection>
                            <Switch checked={darkMode} onChange={(val) => {
                                setTheme(val ? "dark" : "light")
                                setDarkMode(val)
                            }}/>
                        </NavbarSection>
                    </Navbar>
                }
                sidebar={
                    <Sidebar>
                        <SidebarHeader>
                            <SidebarItem>
                                <NavLink to="/">
                                    <Avatar
                                        src={logo}
                                        square
                                        className="w-10 h-10 pr-2 outline-0 dark:invert"/>
                                    <NavbarLabel>Jacumbo</NavbarLabel>
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
