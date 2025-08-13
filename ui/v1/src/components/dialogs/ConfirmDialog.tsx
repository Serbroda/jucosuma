import {Dialog, DialogActions, DialogBody, DialogTitle} from "../catalyst/dialog.tsx";
import {Button} from "../catalyst/button.tsx";
import type {FC} from "react";

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
    return (
        <Dialog open={isOpen} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogBody>
                <span className="text-black dark:text-white">{message}</span>
            </DialogBody>
            <DialogActions>
                <Button
                    onClick={() => onSubmit()}
                    className="hover:cursor-pointer"
                >
                    {submitLabel || "Ok"}
                </Button>
                <Button
                    plain
                    onClick={onClose}
                    className="hover:cursor-pointer"
                >
                    {cancelLabel || "Cancel"}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ConfirmDialog;
