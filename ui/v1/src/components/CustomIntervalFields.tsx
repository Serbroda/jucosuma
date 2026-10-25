import {useTranslation} from "react-i18next";
import {Input} from "./catalyst/input.tsx";
import {Select} from "./catalyst/select.tsx";
import {IntervalUnitDays, IntervalUnitMonths, IntervalUnitWeeks, IntervalUnitYears} from "../gen/types.gen.ts";

const units = [IntervalUnitDays, IntervalUnitWeeks, IntervalUnitMonths, IntervalUnitYears];

/** "Every [6] [weeks]" for a custom interval. With `named`, the fields are submitted with their form. */
export default function CustomIntervalFields({count, unit, onChange, named, invalid}: {
    count: string;
    unit: string;
    onChange: (count: string, unit: string) => void;
    named?: boolean;
    invalid?: boolean;
}) {
    const {t} = useTranslation();
    return (
        <div className="mt-2 flex items-center gap-2">
            <span className="text-sm/6 text-zinc-950 dark:text-white">{t('periods.every')}</span>
            <div className="w-20 shrink-0">
                <Input type="number" inputMode="numeric" min={1} max={999} step={1} required
                       aria-label={t('periods.every')} name={named ? "interval_count" : undefined}
                       value={count} invalid={invalid} onChange={(e) => onChange(e.target.value, unit)}
                       className="[&_input]:text-right"/>
            </div>
            <div className="min-w-0 flex-1">
                <Select aria-label={t('entry.interval')} name={named ? "interval_unit" : undefined}
                        value={unit} onChange={(e) => onChange(count, e.target.value)}>
                    {units.map((u) => <option key={u} value={u}>{t(`periods.units.${u}` as 'periods.units.days')}</option>)}
                </Select>
            </div>
        </div>
    );
}
