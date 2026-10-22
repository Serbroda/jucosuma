import {useTranslation} from "react-i18next";
import {Select} from "./catalyst/select.tsx";
import type {PersonDto} from "../gen/types.gen.ts";
import type {Pot} from "../utils/budget.utils.ts";

/**
 * Who earns an income ("Bezieher"). Independent of the account it is paid into: a salary paid
 * into the joint account still belongs to the person who earns it. Pots are not affected.
 */
export default function EarnerSelect({persons, value, onChange}: {
    persons: PersonDto[];
    value: Pot;
    onChange: (value: Pot) => void;
}) {
    const {t} = useTranslation();
    return (
        <Select value={String(value)} onChange={(e) => onChange(e.target.value === "household" ? "household" : Number(e.target.value))}>
            {persons.filter((p) => p.in_household).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="household">{t('income.earnerShared')}</option>
        </Select>
    );
}
