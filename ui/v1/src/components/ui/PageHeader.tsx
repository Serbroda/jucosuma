import type {ReactNode} from "react";

export default function PageHeader({title, subtitle, actions}: { title: string; subtitle?: string; actions?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-end gap-4">
            <div className="grow min-w-0">
                <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">{title}</h1>
                {subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
