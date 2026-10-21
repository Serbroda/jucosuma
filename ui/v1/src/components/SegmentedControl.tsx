import {classNames} from "../utils/dom.utils.ts";

export interface SegmentedControlProps<T extends string> {
    options: { value: T; label: string; disabled?: boolean; title?: string }[];
    value: T;
    onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({options, value, onChange}: SegmentedControlProps<T>) {
    return (
        <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    disabled={o.disabled}
                    title={o.title}
                    onClick={() => onChange(o.value)}
                    className={classNames(
                        "rounded-md px-2.5 py-1 hover:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                        value === o.value
                            ? "bg-white dark:bg-zinc-950 shadow-sm font-medium text-zinc-950 dark:text-white"
                            : "text-zinc-500 dark:text-zinc-400",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
