import clsx from "clsx";
import {iconFor, type IconComponent, slotColor} from "../../lib/icons.ts";

/** An icon on a soft tile tinted with a palette colour (category / goal identity). */
export default function IconTile({icon, iconComponent, color, className}: {
    icon?: string | null;
    iconComponent?: IconComponent;
    color?: number | null;
    className?: string;
}) {
    const Icon = iconComponent ?? iconFor(icon) ?? iconFor("ellipsis")!;
    const c = slotColor(color);
    return (
        <span
            className={clsx("inline-flex shrink-0 items-center justify-center rounded-lg", className ?? "size-8")}
            style={{background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c}}
        >
            <Icon className="size-[55%]"/>
        </span>
    );
}
