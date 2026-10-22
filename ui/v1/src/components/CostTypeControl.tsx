import {useTranslation} from "react-i18next";
import SegmentedControl from "./SegmentedControl.tsx";
import type {CostType} from "../utils/household.utils.ts";

/** Cost type of an expense with a short explanation of the chosen type. */
export default function CostTypeControl({value, onChange}: { value: CostType; onChange: (value: CostType) => void }) {
    const {t} = useTranslation();
    return (
        <div className="flex flex-col gap-1.5">
            <div className="self-start">
                <SegmentedControl value={value} onChange={onChange} options={[
                    {value: "variable", label: t('costType.variable')},
                    {value: "fixed", label: t('costType.fixed')},
                    {value: "contract", label: t('costType.contract')},
                ]}/>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t(`costType.${value}Hint`)}</p>
        </div>
    );
}
