import {useTranslation} from "react-i18next";
import {Select} from "./catalyst/select.tsx";
import type {BankTransactionDto, CategoryDto, ContractDto} from "../gen/types.gen.ts";
import {bankTargets, selectedTargetValue, targetValue} from "../utils/bank.utils.ts";

/** Select of the targets of a booking (variable costs and categories, grouped). With `placeholder`
 * it is an action ("set category…") and always shows the placeholder; otherwise it shows the
 * current assignment and offers "no category". */
export default function BankTargetSelect({tx, contracts, categories, onChange, placeholder}: {
    tx: BankTransactionDto;
    contracts: ContractDto[];
    categories: CategoryDto[];
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const {t} = useTranslation();
    return (
        <Select value={placeholder ? "" : selectedTargetValue(tx)} aria-label={t("bank.category")}
                onChange={(e) => (!placeholder || e.target.value) && onChange(e.target.value)}>
            <option value="">{placeholder ?? t("bank.noCategory")}</option>
            {bankTargets(tx, contracts, categories, true).map((group) => (
                <optgroup key={group.key} label={t(`bank.group.${group.key}`)}>
                    {group.targets.map((target) => <option key={targetValue(target)} value={targetValue(target)}>{target.label}</option>)}
                </optgroup>
            ))}
        </Select>
    );
}
