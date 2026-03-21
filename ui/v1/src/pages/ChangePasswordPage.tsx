import {useState} from "react";
import {useAuth} from "../stores/useAuth.ts";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Heading} from "../components/catalyst/heading.tsx";
import {ErrorMessage} from "../components/catalyst/fieldset.tsx";

export default function ChangePasswordPage() {
    const {changePassword, user} = useAuth();
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
            setFieldError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setFieldError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            window.location.hash = '#/';
        } catch (err: any) {
            setError(err.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900 px-4">
            <div className="w-full max-w-sm">
                <Heading className="text-center mb-2">Change Password</Heading>
                {user?.must_change_password && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
                        You must change your password before continuing.
                    </p>
                )}

                {error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Field>
                        <Label>Current Password</Label>
                        <Input
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            autoFocus
                        />
                    </Field>
                    <Field>
                        <Label>New Password</Label>
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
                        <Label>Confirm New Password</Label>
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
                        {loading ? 'Changing...' : 'Change Password'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
