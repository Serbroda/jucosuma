import type {FormEvent, ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Dialog, DialogActions, DialogBody, DialogTitle} from "../catalyst/dialog.tsx";
import {Button} from "../catalyst/button.tsx";

/** Dialog with a form body, an error line and save/cancel actions. */
export default function FormDialog({open, title, onClose, onSubmit, saving, error, size = "lg", children}: {
    open: boolean;
    title: string;
    onClose: () => void;
    onSubmit: () => void;
    saving?: boolean;
    error?: string | null;
    size?: "lg" | "xl" | "2xl";
    children: ReactNode;
}) {
    const {t} = useTranslation();
    const submit = (e: FormEvent) => {
        e.preventDefault();
        onSubmit();
    };
    return (
        <Dialog open={open} onClose={onClose} size={size}>
            <form onSubmit={submit}>
                <DialogTitle>{title}</DialogTitle>
                <DialogBody className="grid grid-cols-1 gap-4">
                    {children}
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </DialogBody>
                <DialogActions>
                    <Button plain type="button" onClick={onClose} className="hover:cursor-pointer">{t('common.cancel')}</Button>
                    <Button type="submit" disabled={saving} className="hover:cursor-pointer">
                        {saving ? t('common.saving') : t('common.save')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
