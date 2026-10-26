import {useState} from "react";
import {Trans, useTranslation} from "react-i18next";
import {NavLink} from "react-router";
import type {PersonDto, ShareDto} from "../gen/types.gen.ts";
import {sharePresets} from "../utils/household.utils.ts";
import {isFixedShare, splitPayment} from "../utils/budget.utils.ts";
import {formatDecimal, parseAmount} from "../utils/number.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";

type Unit = "percent" | "fixed";

function sameShares(a: ShareDto[], b: ShareDto[]): boolean {
    const norm = (s: ShareDto[]) => s.filter((x) => x.weight > 0 || isFixedShare(x))
        .map((x) => `${x.person_id}:${x.weight}:${x.amount ?? ""}`).sort().join(",");
    return norm(a) === norm(b);
}

/** Weights as percentages adding up to 100, so a preset (1 / 1) shows as 50 / 50; fixed shares stay. */
function asPercentages(shares: ShareDto[]): ShareDto[] {
    const total = shares.reduce((sum, s) => sum + (isFixedShare(s) ? 0 : s.weight), 0);
    if (total <= 0) return shares;
    return shares.map((s) => isFixedShare(s) ? s : {...s, weight: Math.round(s.weight / total * 10000) / 100});
}

export interface SharesEditorProps {
    persons: PersonDto[];
    value: ShareDto[];
    onChange: (shares: ShareDto[]) => void;
    /** amount of one payment, to show what each person carries */
    amount?: number;
    currency?: string;
}

export default function SharesEditor({persons, value, onChange, amount, currency = "EUR"}: SharesEditorProps) {
    const {t, i18n} = useTranslation();
    const presets = sharePresets(persons);
    const activePreset = presets.find((p) => sameShares(p.shares, value));
    const [custom, setCustom] = useState(!activePreset && value.length > 0);
    // what is typed per person (so "10," can be typed) and whether it is a percentage or a fixed amount
    const [texts, setTexts] = useState<Record<number, string>>({});
    const [units, setUnits] = useState<Record<number, Unit>>({});

    if (persons.length === 0) {
        return (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                <Trans i18nKey="shares.addPersons" components={{link: <NavLink to="/settings/persons" className="underline"/>}}/>
            </p>
        );
    }

    const money = (v: number) => new Intl.NumberFormat(i18n.language, {style: "currency", currency}).format(v);
    const currencySymbol = new Intl.NumberFormat(i18n.language, {style: "currency", currency})
        .formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
    const percentText = (v: number) => v.toLocaleString(i18n.language, {maximumFractionDigits: 1});

    // weights are shown and edited as percentages (a preset 1 / 1 shows as 50 / 50)
    const percentages = asPercentages(value);
    const shareOf = (personId: number) => percentages.find((s) => s.person_id === personId);
    const unitOf = (personId: number): Unit => units[personId] ?? (shareOf(personId) && isFixedShare(shareOf(personId)!) ? "fixed" : "percent");
    const textOf = (personId: number) => {
        if (texts[personId] != null) return texts[personId];
        const share = shareOf(personId);
        if (!share) return "";
        return isFixedShare(share) ? formatDecimal(share.amount) : share.weight.toLocaleString(i18n.language);
    };

    const setPart = (personId: number, text: string, unit: Unit) => {
        setTexts({...texts, [personId]: text});
        const n = parseAmount(text);
        const others = percentages.filter((s) => s.person_id !== personId);
        if (n == null || n <= 0) onChange(others);
        else onChange([...others, unit === "fixed" ? {person_id: personId, weight: 0, amount: n} : {person_id: personId, weight: n}]);
    };

    const known = value.filter((s) => persons.some((p) => p.id === s.person_id));
    const hasFixed = known.some(isFixedShare);
    const weightTotal = known.reduce((sum, s) => sum + (isFixedShare(s) ? 0 : s.weight), 0);
    const percentTotal = percentages.reduce((sum, s) => sum + (isFixedShare(s) ? 0 : s.weight), 0);
    const split = amount ? splitPayment(known, amount) : undefined;
    const isMember = (id: number) => persons.find((p) => p.id === id)?.in_household ?? false;
    // fraction the household carries; with fixed amounts only known for a given amount
    const householdFraction = split && amount
        ? known.reduce((sum, s) => sum + (isMember(s.person_id) ? split.parts.get(s.person_id) ?? 0 : 0), split.rest) / amount
        : !hasFixed && weightTotal > 0
            ? known.reduce((sum, s) => sum + (isMember(s.person_id) ? s.weight : 0), 0) / weightTotal
            : undefined;

    const chip = (active: boolean) => classNames(
        "rounded-full px-3 py-1 text-sm border transition-colors hover:cursor-pointer",
        active
            ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
            : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        className={chip(!custom && activePreset?.key === p.key)}
                        onClick={() => {
                            setCustom(false);
                            onChange(p.shares);
                        }}
                    >
                        {p.label}
                    </button>
                ))}
                <button type="button" className={chip(custom || (!activePreset && value.length > 0))}
                        onClick={() => {
                            if (!custom) {
                                setTexts({});
                                setUnits({});
                            }
                            setCustom(true);
                        }}>
                    {t('shares.custom')}
                </button>
            </div>

            {custom && (
                <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                    {persons.map((p) => {
                        const unit = unitOf(p.id);
                        const share = shareOf(p.id);
                        const part = split?.parts.get(p.id);
                        return (
                            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4rem_4.5rem] items-center gap-2">
                                <span className="text-sm text-zinc-950 dark:text-white truncate">
                                    {p.name}
                                    {!p.in_household && <span className="text-zinc-400 dark:text-zinc-500"> {t('shares.external')}</span>}
                                </span>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    aria-label={t('shares.shareOf', {name: p.name})}
                                    value={textOf(p.id)}
                                    placeholder="0"
                                    className="[&_input]:text-right"
                                    onChange={(e) => setPart(p.id, e.target.value, unit)}
                                />
                                <Select aria-label={t('shares.unit', {name: p.name})} value={unit}
                                        onChange={(e) => {
                                            const next = e.target.value as Unit;
                                            setUnits({...units, [p.id]: next});
                                            setPart(p.id, textOf(p.id), next);
                                        }}>
                                    <option value="percent">%</option>
                                    <option value="fixed">{currencySymbol}</option>
                                </Select>
                                <span className="text-xs tabular-nums text-right text-zinc-500 dark:text-zinc-400">
                                    {part != null && share ? money(part)
                                        : share && !isFixedShare(share) && weightTotal > 0 ? `${percentText(share.weight / percentTotal * 100)} %` : ""}
                                </span>
                            </div>
                        );
                    })}
                    {split && split.rest > 0 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('shares.restWithPayer', {amount: money(split.rest)})}</p>
                    )}
                    {Object.keys(texts).length > 0 && weightTotal > 0 && Math.abs(weightTotal - 100) > 0.01 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">{t('shares.percentSum', {percent: percentText(weightTotal)})}</p>
                    )}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {t('shares.hint')}
                    </p>
                </div>
            )}

            {householdFraction != null && householdFraction < 1 - 1e-9 && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('shares.householdCarries', {percent: percentText(householdFraction * 100)})}
                </p>
            )}
        </div>
    );
}
