import {Outlet, useLocation} from "react-router";
import {useTranslation} from "react-i18next";
import {
    ArrowRightStartOnRectangleIcon,
    ArrowsRightLeftIcon,
    BuildingLibraryIcon,
    Cog6ToothIcon,
    HomeIcon,
    MoonIcon,
    ReceiptPercentIcon,
    ShieldCheckIcon,
    SparklesIcon,
    SunIcon,
    TagIcon,
    UserGroupIcon,
    UsersIcon,
    WalletIcon,
} from "@heroicons/react/20/solid";
import MonthPicker from "../components/ui/MonthPicker.tsx";
import {SidebarLayout} from "../components/catalyst/sidebar-layout.tsx";
import {Navbar, NavbarItem, NavbarSection, NavbarSpacer} from "../components/catalyst/navbar.tsx";
import {
    Sidebar,
    SidebarBody,
    SidebarFooter,
    SidebarHeader,
    SidebarItem,
    SidebarLabel,
    SidebarSection,
    SidebarSpacer,
} from "../components/catalyst/sidebar.tsx";
import {Avatar} from "../components/catalyst/avatar.tsx";
import {usePreferences} from "../stores/usePreferences.ts";
import {useAuth} from "../stores/useAuth.ts";
import logo from '../assets/logo.svg'

function MainLayout() {
    const {theme, setTheme} = usePreferences()
    const {user, logout} = useAuth()
    const {t} = useTranslation()
    const {pathname} = useLocation()
    const isAdmin = user?.role === 'admin'
    const dark = theme === "dark"

    const handleLogout = async () => {
        await logout()
        window.location.hash = '#/login'
    }

    const navItems = [
        {label: t('nav.overview'), url: '/', icon: HomeIcon},
        {label: t('nav.income'), url: '/income', icon: WalletIcon},
        {label: t('nav.expenses'), url: '/expenses', icon: ReceiptPercentIcon},
        {label: t('nav.transfers'), url: '/transfers', icon: ArrowsRightLeftIcon},
        {label: t('nav.contracts'), url: '/contracts', icon: ShieldCheckIcon},
        {label: t('nav.savings'), url: '/savings', icon: SparklesIcon},
        {label: t('nav.accounts'), url: '/accounts', icon: BuildingLibraryIcon},
        {label: t('nav.categories'), url: '/categories', icon: TagIcon},
        {label: t('nav.persons'), url: '/persons', icon: UserGroupIcon},
        ...(isAdmin ? [{label: t('nav.users'), url: '/users', icon: UsersIcon}] : []),
    ]
    const isCurrent = (url: string) =>
        url === '/' ? pathname === '/' : pathname.startsWith(url)
    const showMonth = !['/settings', '/users', '/contracts'].some((p) => pathname.startsWith(p))

    const ThemeIcon = dark ? SunIcon : MoonIcon

    return (
        <div className="text-black dark:text-white">
            <SidebarLayout
                navbar={
                    <Navbar>
                        <NavbarSpacer/>
                        <NavbarSection>
                            <NavbarItem onClick={() => setTheme(dark ? "light" : "dark")} aria-label={t('nav.toggleTheme')}>
                                <ThemeIcon/>
                            </NavbarItem>
                            <NavbarItem onClick={handleLogout} aria-label={t('nav.logout')}>
                                <ArrowRightStartOnRectangleIcon/>
                            </NavbarItem>
                        </NavbarSection>
                    </Navbar>
                }
                sidebar={
                    <Sidebar>
                        <SidebarHeader>
                            <div className="flex items-center gap-3 px-2 py-1">
                                <Avatar src={logo} square className="size-9 outline-0 dark:invert"/>
                                <div className="flex flex-col">
                                    <span className="text-base font-semibold text-zinc-950 dark:text-white">Jucosuma</span>
                                    <a href="https://github.com/Serbroda/jucosuma/releases" target="_blank"
                                       className="text-xs text-zinc-500 dark:text-zinc-400 hover:underline font-mono">
                                        v{__APP_VERSION__}
                                    </a>
                                </div>
                            </div>
                        </SidebarHeader>
                        <SidebarBody>
                            <SidebarSection>
                                {navItems.map(({label, url, icon: Icon}) => (
                                    <SidebarItem key={url} href={url} current={isCurrent(url)}>
                                        <Icon/>
                                        <SidebarLabel>{label}</SidebarLabel>
                                    </SidebarItem>
                                ))}
                            </SidebarSection>
                            <SidebarSpacer/>
                            <SidebarSection>
                                <SidebarItem href="/settings" current={isCurrent('/settings')}>
                                    <Cog6ToothIcon/>
                                    <SidebarLabel>{t('nav.settings')}</SidebarLabel>
                                </SidebarItem>
                                <SidebarItem onClick={() => setTheme(dark ? "light" : "dark")}>
                                    <ThemeIcon/>
                                    <SidebarLabel>{dark ? t('nav.lightMode') : t('nav.darkMode')}</SidebarLabel>
                                </SidebarItem>
                            </SidebarSection>
                        </SidebarBody>
                        <SidebarFooter>
                            <SidebarItem onClick={handleLogout}>
                                <Avatar initials={user?.username?.slice(0, 2) ?? "?"}
                                        className="size-6 bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"/>
                                <SidebarLabel className="grow">{user?.username}</SidebarLabel>
                                <ArrowRightStartOnRectangleIcon/>
                            </SidebarItem>
                        </SidebarFooter>
                    </Sidebar>
                }
            >
                <div className="flex flex-wrap items-center gap-3 mb-8">
                    <div className="flex items-center gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200">
                        <HomeIcon className="size-4 text-zinc-500"/>{t('nav.ourHousehold')}
                    </div>
                    {showMonth && <div className="ml-auto"><MonthPicker/></div>}
                </div>
                <Outlet/>
            </SidebarLayout>
        </div>
    );
}

export default MainLayout
