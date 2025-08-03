import {StackedLayout} from "../components/catalyst/stacked-layout.tsx";
import {Navbar, NavbarDivider, NavbarItem, NavbarLabel, NavbarSection} from "../components/catalyst/navbar.tsx";
import {Sidebar, SidebarBody, SidebarHeader, SidebarItem, SidebarSection} from "../components/catalyst/sidebar.tsx";
import {href, NavLink, Outlet} from "react-router";
import {Avatar} from "../components/catalyst/avatar.tsx";

import reactLogo from '../assets/react.svg'

const navItems = [
    {label: 'HomePage', url: '/'},
    {label: 'Persons', url: '/persons'},
    {label: 'Settings', url: '/settings'},
    {label: 'AboutPage', url: '/about'},
]

function MainLayout() {
    return (
        <div>
            <StackedLayout
                navbar={
                    <Navbar>
                        <NavbarSection className="max-lg:hidden">
                            <NavbarItem>
                                <NavLink to="/">
                                    <Avatar src={reactLogo} className="pr-2"/>
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
                    </Navbar>
                }
                sidebar={
                    <Sidebar>
                        <SidebarHeader>
                            <SidebarItem>
                                <NavLink to="/">
                                    <Avatar src={reactLogo} className="pr-2"/>
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
