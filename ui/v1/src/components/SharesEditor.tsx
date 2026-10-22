import {useState} from "react";
import {Trans, useTranslation} from "react-i18next";
import {NavLink} from "react-router";
import type {PersonDto, ShareDto} from "../gen/types.gen.ts";
import {sharePresets} from "../utils/household.utils.ts";
import {classNames} from "../utils/dom.utils.ts";
import {Input} from "./catalyst/input.tsx";

function sameShares(a: ShareDto[], b: ShareDto[]): boolean {
    const norm = (s: ShareDto[]) => s.filter((x) => x.weight > 0).map((x) => `${x.person_id}:${x.weight}`).sort().join(",");
    return norm(a) === norm(b);
}

export interface SharesEditorProps {
    persons: PersonDto[];
    value: ShareDto[];
    onChange: (shares: ShareDto[]) => void;
}

export default function SharesEditor({persons, value, onChange}: SharesEditorProps) {
    const {t, i18n} = useTranslation();
    const presets = sharePresets(persons);
    const activePreset = presets.find((p) => sameShares(p.shares, value));
    const [custom, setCustom] = useState(!activePreset && value.length > 0);

    if (persons.length === 0) {
        return (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                <Trans i18nKey="shares.addPersons" components={{link: <NavLink to="/settings/persons" className="underline"/>}}/>
            </p>
        );
    }

    const total = value.reduce((sum, s) => sum + (s.weight > 0 ? s.weight : 0), 0);
    const householdTotal = value
        .filter((s) => persons.find((p) => p.id === s.person_id)?.in_household)
        .reduce((sum, s) => sum + (s.weight > 0 ? s.weight : 0), 0);

    const weightOf = (personId: number) => value.find((s) => s.person_id === personId)?.weight;

    const setWeight = (personId: number, weight: number) => {
        const others = value.filter((s) => s.person_id !== personId);
        onChange(weight > 0 ? [...others, {person_id: personId, weight}] : others);
    };

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
                        onClick={() => setCustom(true)}>
                    {t('shares.custom')}
                </button>
            </div>

            {custom && (
                <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                    {persons.map((p) => {
                        const weight = weightOf(p.id);
                        const percent = total > 0 && weight ? (weight / total) * 100 : 0;
                        return (
                            <div key={p.id} className="grid grid-cols-[1fr_5rem_3.5rem] items-center gap-2">
                                <span className="text-sm text-zinc-950 dark:text-white truncate">
                                    {p.name}
                                    {!p.in_household && <span className="text-zinc-400 dark:text-zinc-500"> {t('shares.external')}</span>}
                                </span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    aria-label={t('shares.shareOf', {name: p.name})}
                                    value={weight ?? ""}
                                    placeholder="0"
                                    onChange={(e) => setWeight(p.id, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-xs tabular-nums text-right text-zinc-500 dark:text-zinc-400">
                                    {percent.toLocaleString(i18n.language, {maximumFractionDigits: 1})} %
                                </span>
                            </div>
                        );
                    })}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {t('shares.hint')}
                    </p>
                </div>
            )}

            {total > 0 && householdTotal < total && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('shares.householdCarries', {
                        percent: (householdTotal / total * 100).toLocaleString(i18n.language, {maximumFractionDigits: 1}),
                    })}
                </p>
            )}
        </div>
    );
}
