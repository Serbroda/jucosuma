import {useState} from "react";
import {useAuth} from "../stores/useAuth.ts";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {ErrorMessage} from "../components/catalyst/fieldset.tsx";
import AuthShell from "../components/AuthShell.tsx";
import {useTranslation} from "react-i18next";

export default function ChangePasswordPage() {
    const {changePassword, user} = useAuth();
    const {t} = useTranslation();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldError('');

        if (newPassword.length < 8) {
            setFieldError(t('auth.tooShort'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setFieldError(t('auth.mismatch'));
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            window.location.hash = '#/';
        } catch (err: any) {
            setError(err.message || t('auth.changeFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title={t('auth.changePassword')} subtitle={user?.must_change_password ? t('auth.mustChange') : undefined} error={error}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field>
                <Label>{t('auth.currentPassword')}</Label>
                <Input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoFocus
                />
            </Field>
            <Field>
                <Label>{t('auth.newPassword')}</Label>
                <Input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                        setNewPassword(e.target.value);
                        setFieldError('');
                    }}
                    invalid={!!fieldError}
                />
            </Field>
            <Field>
                <Label>{t('auth.confirmPassword')}</Label>
                <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setFieldError('');
                    }}
                    invalid={!!fieldError}
                />
                {fieldError && <ErrorMessage>{fieldError}</ErrorMessage>}
            </Field>
            <Button type="submit" disabled={loading} className="w-full mt-2 hover:cursor-pointer">
                {loading ? t('auth.changing') : t('auth.changePassword')}
            </Button>
        </form>
        </AuthShell>
    );
}
