import type {ComponentType, SVGProps} from "react";
import {
    AcademicCapIcon,
    BanknotesIcon,
    BoltIcon,
    BriefcaseIcon,
    BuildingLibraryIcon,
    CakeIcon,
    ChartBarIcon,
    CpuChipIcon,
    CreditCardIcon,
    DevicePhoneMobileIcon,
    EllipsisHorizontalCircleIcon,
    FilmIcon,
    GiftIcon,
    GlobeEuropeAfricaIcon,
    HeartIcon,
    HomeIcon,
    LifebuoyIcon,
    MusicalNoteIcon,
    PaperAirplaneIcon,
    RocketLaunchIcon,
    ShieldCheckIcon,
    ShoppingBagIcon,
    ShoppingCartIcon,
    SparklesIcon,
    SunIcon,
    TicketIcon,
    TrophyIcon,
    TruckIcon,
    TvIcon,
    UserGroupIcon,
    WalletIcon,
    WifiIcon,
    WrenchScrewdriverIcon,
} from "@heroicons/react/20/solid";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Icons selectable for categories and savings goals, stored by key. */
export const icons: Record<string, IconComponent> = {
    "home": HomeIcon,
    "shopping-cart": ShoppingCartIcon,
    "shopping-bag": ShoppingBagIcon,
    "film": FilmIcon,
    "tv": TvIcon,
    "music": MusicalNoteIcon,
    "truck": TruckIcon,
    "plane": PaperAirplaneIcon,
    "shield": ShieldCheckIcon,
    "cpu": CpuChipIcon,
    "phone": DevicePhoneMobileIcon,
    "wifi": WifiIcon,
    "bolt": BoltIcon,
    "ticket": TicketIcon,
    "heart": HeartIcon,
    "academic-cap": AcademicCapIcon,
    "banknotes": BanknotesIcon,
    "wallet": WalletIcon,
    "credit-card": CreditCardIcon,
    "bank": BuildingLibraryIcon,
    "chart": ChartBarIcon,
    "briefcase": BriefcaseIcon,
    "gift": GiftIcon,
    "cake": CakeIcon,
    "sun": SunIcon,
    "globe": GlobeEuropeAfricaIcon,
    "rocket": RocketLaunchIcon,
    "trophy": TrophyIcon,
    "users": UserGroupIcon,
    "lifebuoy": LifebuoyIcon,
    "sparkles": SparklesIcon,
    "tools": WrenchScrewdriverIcon,
    "ellipsis": EllipsisHorizontalCircleIcon,
};

export function iconFor(key: string | null | undefined): IconComponent | undefined {
    return key ? icons[key] : undefined;
}

/** CSS colour of a palette slot (1-16); without slot the neutral "other" colour. */
export function slotColor(slot: number | null | undefined): string {
    return slot ? `var(--chart-${slot})` : "var(--chart-other)";
}

export const colorSlots = Array.from({length: 16}, (_, i) => i + 1);

const SYMBOL_PREFIX = "symbol:";

/** icon_source value for a built-in symbol, e.g. "symbol:plane:3". */
export function symbolSource(icon: string, color?: number): string {
    return `${SYMBOL_PREFIX}${icon}:${color ?? ""}`;
}

/** Parses a built-in symbol icon_source; null for image URLs / data URLs. */
export function parseSymbol(source: string | null | undefined): { icon: string; color?: number } | null {
    if (!source?.startsWith(SYMBOL_PREFIX)) return null;
    const [icon, color] = source.slice(SYMBOL_PREFIX.length).split(":");
    return {icon, color: color ? Number(color) : undefined};
}
