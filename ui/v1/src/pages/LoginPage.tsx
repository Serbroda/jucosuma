import {useState} from "react";
import {useAuth} from "../stores/useAuth.ts";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Button} from "../components/catalyst/button.tsx";
import AuthShell from "../components/AuthShell.tsx";
import {useTranslation} from "react-i18next";

export default function LoginPage() {
    const {login} = useAuth();
    const {t} = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(username, password);
            if (user.must_change_password) {
                window.location.hash = '#/change-password';
            } else {
                window.location.hash = '#/';
            }
        } catch (err: any) {
            setError(err.message || t('auth.loginFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell title={t('auth.welcome')} subtitle={t('auth.welcomeHint')} error={error}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field>
                    <Label>{t('auth.username')}</Label>
                    <Input
                        name="username"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoFocus
                    />
                </Field>
                <Field>
                    <Label>{t('auth.password')}</Label>
                    <Input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </Field>
                <Button type="submit" disabled={loading} className="w-full mt-2 hover:cursor-pointer">
                    {loading ? t('auth.signingIn') : t('auth.signIn')}
                </Button>
            </form>
        </AuthShell>
    );
}
