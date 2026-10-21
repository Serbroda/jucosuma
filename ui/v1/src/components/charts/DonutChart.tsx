import {useState} from "react";
import {classNames} from "../../utils/dom.utils.ts";

export type DonutSegment = { key: string; label: string; value: number; color: string };

export interface DonutChartProps {
    segments: DonutSegment[];
    centerValue: string;
    centerLabel: string;
    format: (value: number) => string;
    emptyText: string;
}

const SIZE = 180;
const R_OUTER = 88;
const R_INNER = 60;

function arcPath(start: number, end: number): string {
    // full circle needs two arcs
    if (end - start >= Math.PI * 2 - 1e-6) end = start + Math.PI * 2 - 1e-4;
    const c = SIZE / 2;
    const p = (r: number, a: number) => `${c + r * Math.sin(a)},${c - r * Math.cos(a)}`;
    const large = end - start > Math.PI ? 1 : 0;
    return [
        `M${p(R_OUTER, start)}`,
        `A${R_OUTER},${R_OUTER} 0 ${large} 1 ${p(R_OUTER, end)}`,
        `L${p(R_INNER, end)}`,
        `A${R_INNER},${R_INNER} 0 ${large} 0 ${p(R_INNER, start)}`,
        "Z",
    ].join(" ");
}

/** Donut with a legend table (label, amount, share). Hovering a slice or a legend row highlights both. */
export default function DonutChart({segments, centerValue, centerLabel, format, emptyText}: DonutChartProps) {
    const [active, setActive] = useState<string | null>(null);
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    if (total <= 0) {
        return <div className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">{emptyText}</div>;
    }

    let angle = 0;
    const arcs = segments.map((s) => {
        const start = angle;
        angle += (s.value / total) * Math.PI * 2;
        return {...s, start, end: angle};
    });
    const activeSegment = segments.find((s) => s.key === active);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0" role="img"
                 aria-label={`${centerLabel}: ${centerValue}`}>
                {arcs.map((a) => (
                    <path
                        key={a.key}
                        d={arcPath(a.start, a.end)}
                        fill={a.color}
                        stroke="var(--chart-surface)"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        opacity={active && active !== a.key ? 0.35 : 1}
                        className="transition-opacity cursor-default"
                        onPointerEnter={() => setActive(a.key)}
                        onPointerLeave={() => setActive(null)}
                    >
                        <title>{`${a.label}: ${format(a.value)}`}</title>
                    </path>
                ))}
                <text x="50%" y="47%" textAnchor="middle" fontSize={20} fontWeight={600} fill="var(--chart-ink)">
                    {activeSegment ? format(activeSegment.value) : centerValue}
                </text>
                <text x="50%" y="58%" textAnchor="middle" fontSize={12} fill="var(--chart-muted)">
                    {activeSegment ? activeSegment.label : centerLabel}
                </text>
            </svg>

            <table className="w-full text-sm">
                <tbody>
                {segments.map((s) => (
                    <tr
                        key={s.key}
                        onPointerEnter={() => setActive(s.key)}
                        onPointerLeave={() => setActive(null)}
                        className={classNames("transition-opacity", active && active !== s.key ? "opacity-40" : "")}
                    >
                        <td className="py-1 pr-2 w-4">
                            <span className="block size-2.5 rounded-full" style={{background: s.color}}/>
                        </td>
                        <td className="py-1 text-zinc-950 dark:text-white truncate max-w-40">{s.label}</td>
                        <td className="py-1 text-right tabular-nums font-medium text-zinc-950 dark:text-white whitespace-nowrap">
                            {format(s.value)}
                        </td>
                        <td className="py-1 pl-3 text-right tabular-nums text-zinc-400 dark:text-zinc-500 w-12">
                            {Math.round(s.value / total * 100)} %
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
