import {useEffect, useRef, useState} from "react";
import {numberLocale} from "../../utils/number.utils.ts";

export type StackSeries = { key: string; label: string; color: string };
export type StackColumn = { key: string; label: string; values: Record<string, number>; highlight?: boolean };

const HEIGHT = 200;
const PAD = {top: 12, right: 8, bottom: 26, left: 52};
const GAP = 2;
const MAX_BAR = 28;

function niceMax(max: number): { top: number; ticks: number[] } {
    if (max <= 0) return {top: 1, ticks: [0]};
    const rough = max / 4;
    const mag = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? rough;
    const ticks: number[] = [];
    for (let v = 0; v < max + step; v += step) ticks.push(v);
    return {top: ticks[ticks.length - 1], ticks};
}

/** Stacked columns with legend and per-column tooltip. Bottom segment first. */
export default function StackedBars({series, columns, format}: {
    series: StackSeries[];
    columns: StackColumn[];
    format: (v: number) => string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(600);
    const [hover, setHover] = useState<number | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
        ro.observe(ref.current);
        return () => ro.disconnect();
    }, []);

    const totals = columns.map((c) => series.reduce((s, ser) => s + (c.values[ser.key] ?? 0), 0));
    const {top, ticks} = niceMax(Math.max(...totals, 0));
    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const band = plotW / Math.max(1, columns.length);
    const barW = Math.min(MAX_BAR, band * 0.5);
    const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
    const axis = (v: number) => new Intl.NumberFormat(numberLocale(), {maximumFractionDigits: 0}).format(v);

    return (
        <div ref={ref} className="relative">
            {series.length > 1 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300 mb-2 justify-end">
                    {series.map((s) => (
                        <span key={s.key} className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-sm" style={{background: s.color}}/>{s.label}
                        </span>
                    ))}
                </div>
            )}
            <svg width={width} height={HEIGHT} className="block" role="img">
                {ticks.map((tick) => (
                    <g key={tick}>
                        <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} shapeRendering="crispEdges"
                              stroke={tick === 0 ? "var(--chart-muted)" : "var(--chart-grid)"} strokeWidth={1}/>
                        <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--chart-muted)">
                            {axis(tick)}
                        </text>
                    </g>
                ))}
                {columns.map((col, i) => {
                    const x = PAD.left + band * i + (band - barW) / 2;
                    const parts = series.map((s) => ({s, v: col.values[s.key] ?? 0})).filter((p) => p.v > 0);
                    let acc = 0;
                    return (
                        <g key={col.key}>
                            {hover === i && <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} rx={4}
                                                  fill="var(--chart-grid)" opacity={0.5}/>}
                            {parts.map((p, j) => {
                                const y0 = y(acc);
                                acc += p.v;
                                const y1 = y(acc);
                                const isTop = j === parts.length - 1;
                                const yTop = isTop ? y1 : y1 + GAP;
                                const h = Math.max(0, y0 - yTop);
                                const r = isTop ? Math.min(4, barW / 2, h) : 0;
                                return (
                                    <path key={p.s.key} fill={p.s.color}
                                          d={`M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yTop + h} Z`}/>
                                );
                            })}
                            <text x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11}
                                  fill={col.highlight ? "var(--chart-ink)" : "var(--chart-muted)"} fontWeight={col.highlight ? 600 : 400}>
                                {col.label}
                            </text>
                            <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH + PAD.bottom} fill="transparent"
                                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}/>
                        </g>
                    );
                })}
            </svg>
            {hover != null && (
                <div className="pointer-events-none absolute z-10 rounded-lg bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 px-3 py-2 text-xs min-w-40"
                     style={{left: Math.min(Math.max(0, PAD.left + band * hover + band / 2 - 80), width - 170), top: 24}}>
                    <div className="font-medium text-zinc-950 dark:text-white mb-1">{columns[hover].label}</div>
                    {series.map((s) => (
                        <div key={s.key} className="flex items-center gap-2 py-0.5">
                            <span className="w-3 h-0.5 rounded" style={{background: s.color}}/>
                            <span className="text-zinc-500 dark:text-zinc-400 grow">{s.label}</span>
                            <span className="font-semibold tabular-nums text-zinc-950 dark:text-white">{format(columns[hover].values[s.key] ?? 0)}</span>
                        </div>
                    ))}
                    {series.length > 1 && (
                        <div className="flex justify-between border-t border-zinc-100 dark:border-zinc-700 mt-1 pt-1">
                            <span className="text-zinc-500 dark:text-zinc-400">Σ</span>
                            <span className="font-semibold tabular-nums text-zinc-950 dark:text-white">{format(totals[hover])}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
