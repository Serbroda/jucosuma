import {Dialog, DialogActions, DialogBody, DialogTitle} from "../catalyst/dialog.tsx";
import {Button} from "../catalyst/button.tsx";
import type {FC} from "react";
import {useTranslation} from "react-i18next";

export interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    submitLabel?: string;
    cancelLabel?: string;
    onClose: () => void;
    onSubmit: () => Promise<void>;
}

const ConfirmDialog: FC<ConfirmDialogProps> = ({
                                                   isOpen,
                                                   title,
                                                   message,
                                                   submitLabel,
                                                   cancelLabel,
                                                   onClose,
                                                   onSubmit
                                               }) => {
    const {t} = useTranslation();
    return (
        <Dialog open={isOpen} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogBody>
                <span className="text-black dark:text-white">{message}</span>
            </DialogBody>
            <DialogActions>
                <Button plain onClick={onClose} className="hover:cursor-pointer">
                    {cancelLabel || t("common.cancel")}
                </Button>
                {/* confirmations are used for deleting */}
                <Button color="red" onClick={() => onSubmit()} className="hover:cursor-pointer">
                    {submitLabel || t("common.ok")}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ConfirmDialog;
