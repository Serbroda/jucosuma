import {useEffect, useRef, useState} from "react";

export type SankeyNode = { key: string; label: string; value: number; color: string };

export interface SankeyChartProps {
    sources: SankeyNode[];
    targets: SankeyNode[];
    centerLabel: string;
    format: (value: number) => string;
}

const NODE_W = 10;
const GAP = 10;
const MIN_NODE = 4;
const LABEL_W = 132;

type Placed = SankeyNode & { y: number; h: number };

const LABEL_GAP = 30; // two text lines
const FLOW_HEIGHT = 220; // pixels for the full total
const PAD = 8;

/**
 * Stacks nodes vertically. Node heights are proportional (with a small minimum);
 * centers keep at least LABEL_GAP apart so every label sits right next to its node.
 */
function place(nodes: SankeyNode[], scale: number): Placed[] {
    const placed: Placed[] = [];
    let nextTop = PAD;
    for (const n of nodes) {
        const h = Math.max(MIN_NODE, n.value * scale);
        const prev = placed[placed.length - 1];
        let center = nextTop + h / 2;
        if (prev) center = Math.max(center, prev.y + prev.h / 2 + LABEL_GAP);
        const y = center - h / 2;
        placed.push({...n, y, h});
        nextTop = y + h + GAP;
    }
    return placed;
}

const extent = (nodes: Placed[]) => nodes.length ? nodes[nodes.length - 1].y + nodes[nodes.length - 1].h : 0;

/** Moves a column down so it is vertically centered in the given height. */
const centerColumn = (nodes: Placed[], height: number) => {
    const offset = (height - PAD - extent(nodes)) / 2;
    return nodes.map((n) => ({...n, y: n.y + offset}));
};

/** Band between two vertical segments drawn as cubic curves. */
function ribbon(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number): string {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h1} C${mx},${y1 + h1} ${mx},${y0 + h0} ${x0},${y0 + h0} Z`;
}

/**
 * Three-column sankey: sources → one center node → targets.
 * Sources and targets must sum to the same total.
 */
export default function SankeyChart({sources, targets, centerLabel, format}: SankeyChartProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(640);
    const [active, setActive] = useState<string | null>(null);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const total = targets.reduce((sum, n) => sum + n.value, 0);
    const scale = total > 0 ? FLOW_HEIGHT / total : 0;
    const labelW = width < 520 ? 96 : LABEL_W;

    const xLeft = labelW;
    const xCenter = width / 2 - NODE_W / 2;
    const xRight = width - labelW - NODE_W;

    const leftRaw = place(sources, scale);
    const rightRaw = place(targets, scale);
    const height = Math.max(extent(leftRaw), extent(rightRaw), FLOW_HEIGHT) + PAD * 2;
    const left = centerColumn(leftRaw, height);
    const right = centerColumn(rightRaw, height);
    const center = {y: (height - total * scale) / 2, h: total * scale};

    const dim = (key: string) => (active && active !== key ? 0.25 : 1);

    // offsets inside the center node for incoming and outgoing bands: each band starts below the previous one
    const offsets = (nodes: Placed[]) => nodes.reduce<number[]>(
        (all, _n, i) => [...all, i === 0 ? center.y : all[i - 1] + nodes[i - 1].value * scale], []);
    const inY = offsets(left);
    const outY = offsets(right);

    const label = (n: Placed, side: "left" | "right") => {
        const x = side === "left" ? xLeft - 8 : xRight + NODE_W + 8;
        const anchor = side === "left" ? "end" : "start";
        const cy = n.y + n.h / 2;
        return (
            <g opacity={dim(n.key)}>
                <text x={x} y={cy - 2} textAnchor={anchor} fontSize={12} fill="var(--chart-ink)">
                    {n.label.length > 18 && labelW < LABEL_W ? n.label.slice(0, 16) + "…" : n.label}
                </text>
                <text x={x} y={cy + 12} textAnchor={anchor} fontSize={11} fill="var(--chart-muted)" className="tabular-nums">
                    {format(n.value)}
                </text>
            </g>
        );
    };

    return (
        <div ref={wrapRef}>
            <svg width={width} height={height} role="img" aria-label={centerLabel} className="block overflow-visible">
                {left.map((n, i) => {
                    const h = n.value * scale;
                    const path = ribbon(xLeft + NODE_W, n.y, n.h, xCenter, inY[i], h);
                    return (
                        <path key={`in-${n.key}`} d={path} fill={n.color} style={{fillOpacity: "var(--chart-ribbon-opacity)"}}
                              opacity={dim(n.key)} onPointerEnter={() => setActive(n.key)} onPointerLeave={() => setActive(null)}>
                            <title>{`${n.label}: ${format(n.value)}`}</title>
                        </path>
                    );
                })}
                {right.map((n, i) => {
                    const h = n.value * scale;
                    const path = ribbon(xCenter + NODE_W, outY[i], h, xRight, n.y, n.h);
                    return (
                        <path key={`out-${n.key}`} d={path} fill={n.color} style={{fillOpacity: "var(--chart-ribbon-opacity)"}}
                              opacity={dim(n.key)} onPointerEnter={() => setActive(n.key)} onPointerLeave={() => setActive(null)}>
                            <title>{`${n.label}: ${format(n.value)}`}</title>
                        </path>
                    );
                })}

                {left.map((n) => (
                    <g key={`ln-${n.key}`}>
                        <rect x={xLeft} y={n.y} width={NODE_W} height={n.h} rx={2} fill={n.color} opacity={dim(n.key)}/>
                        {label(n, "left")}
                    </g>
                ))}
                <rect x={xCenter} y={center.y} width={NODE_W} height={center.h} rx={2} fill="var(--chart-ink)"/>
                <text x={xCenter + NODE_W / 2} y={Math.max(12, center.y - 8)} textAnchor="middle" fontSize={11}
                      fill="var(--chart-muted)">
                    {centerLabel}
                </text>
                {right.map((n) => (
                    <g key={`rn-${n.key}`}>
                        <rect x={xRight} y={n.y} width={NODE_W} height={n.h} rx={2} fill={n.color} opacity={dim(n.key)}/>
                        {label(n, "right")}
                    </g>
                ))}
            </svg>
        </div>
    );
}
