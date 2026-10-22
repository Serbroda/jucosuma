import {Outlet, useLocation, useMatches} from "react-router";
import {type ContractDto, EntryKindIncome, EntryKindTransfer} from "../gen/types.gen.ts";
import {useTranslation} from "react-i18next";
import {
    ArrowRightStartOnRectangleIcon,
    ArrowsRightLeftIcon,
    ClipboardDocumentCheckIcon,
    BuildingLibraryIcon,
    Cog6ToothIcon,
    HomeIcon,
    ReceiptPercentIcon,
    ShieldCheckIcon,
    SparklesIcon,
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
import {useAuth} from "../stores/useAuth.ts";
import logo from '../assets/logo.svg'

function MainLayout() {
    const {user, logout} = useAuth()
    const {t} = useTranslation()
    const {pathname} = useLocation()

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
        {label: t('nav.closing'), url: '/closing', icon: ClipboardDocumentCheckIcon},
        {label: t('nav.savings'), url: '/savings', icon: SparklesIcon},
        {label: t('nav.accounts'), url: '/accounts', icon: BuildingLibraryIcon},
    ]
    // entry pages live under /contracts/…; highlight the menu item matching the entry's kind instead
    const entry = useMatches().map((m) => (m.data as { contract?: ContractDto } | undefined)?.contract).find(Boolean)
    const entryNav = !entry ? undefined
        : entry.kind === EntryKindIncome ? '/income'
            : entry.kind === EntryKindTransfer ? '/transfers'
                : entry.is_contract ? '/contracts' : '/expenses'
    const isCurrent = (url: string) => pathname.startsWith('/contracts/')
        ? url === entryNav
        : url === '/' ? pathname === '/' : pathname.startsWith(url)
    // pages without month context (the closing page has its own month list)
    const showMonth = !['/settings', '/contracts', '/closing'].some((p) => pathname.startsWith(p))

    return (
        <div className="text-black dark:text-white">
            <SidebarLayout
                navbar={
                    <Navbar>
                        <NavbarSpacer/>
                        <NavbarSection>
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
                {showMonth && <div className="flex justify-end mb-4"><MonthPicker/></div>}
                <Outlet/>
            </SidebarLayout>
        </div>
    );
}

export default MainLayout
