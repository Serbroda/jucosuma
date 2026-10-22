import {useTranslation} from "react-i18next";
import SegmentedControl from "./SegmentedControl.tsx";
import {TransferTypeMove, TransferTypeSaving, TransferTypeWithdrawal} from "../gen/types.gen.ts";

/** Type of a transfer with a short explanation; warns when savings are counted from a savings account. */
export default function TransferTypeControl({value, onChange, fromSavings}: {
    value: string;
    onChange: (value: string) => void;
    /** The money comes from a savings account. */
    fromSavings?: boolean;
}) {
    const {t} = useTranslation();
    return (
        <div className="flex flex-col gap-1.5">
            <div className="self-start">
                <SegmentedControl value={value} onChange={onChange} options={[
                    {value: TransferTypeSaving, label: t('transferType.saving')},
                    {value: TransferTypeWithdrawal, label: t('transferType.withdrawal')},
                    {value: TransferTypeMove, label: t('transferType.move')},
                ]}/>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {value === TransferTypeSaving ? t('transferType.savingHint')
                    : value === TransferTypeWithdrawal ? t('transferType.withdrawalHint') : t('transferType.moveHint')}
            </p>
            {value === TransferTypeSaving && fromSavings && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{t('transferType.savingFromSavings')}</p>
            )}
        </div>
    );
}
