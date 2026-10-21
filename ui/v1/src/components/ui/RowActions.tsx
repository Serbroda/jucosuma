import {useState} from "react";
import {useTranslation} from "react-i18next";
import {EllipsisHorizontalIcon, PencilIcon, TrashIcon} from "@heroicons/react/16/solid";
import {Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu} from "../catalyst/dropdown.tsx";
import ConfirmDialog from "../dialogs/ConfirmDialog.tsx";

/** "…" menu for a table row with edit and (confirmed) delete. */
export default function RowActions({onEdit, onDelete, deleteMessage}: {
    onEdit: () => void;
    onDelete?: () => Promise<void>;
    deleteMessage?: string;
}) {
    const {t} = useTranslation();
    const [confirm, setConfirm] = useState(false);
    return (
        <>
            <Dropdown>
                <DropdownButton plain aria-label={t('common.actions')} className="hover:cursor-pointer">
                    <EllipsisHorizontalIcon/>
                </DropdownButton>
                <DropdownMenu anchor="bottom end">
                    <DropdownItem onClick={onEdit}>
                        <PencilIcon/>
                        <DropdownLabel>{t('common.edit')}</DropdownLabel>
                    </DropdownItem>
                    {onDelete && (
                        <DropdownItem onClick={() => setConfirm(true)}>
                            <TrashIcon/>
                            <DropdownLabel>{t('common.delete')}</DropdownLabel>
                        </DropdownItem>
                    )}
                </DropdownMenu>
            </Dropdown>
            {onDelete && (
                <ConfirmDialog
                    isOpen={confirm}
                    title={t('common.delete')}
                    message={deleteMessage ?? t('common.confirmDelete')}
                    submitLabel={t('common.delete')}
                    onClose={() => setConfirm(false)}
                    onSubmit={async () => {
                        await onDelete();
                        setConfirm(false);
                    }}
                />
            )}
        </>
    );
}
