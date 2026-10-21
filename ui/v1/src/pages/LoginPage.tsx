import {useState} from "react";
import {useAuth} from "../stores/useAuth.ts";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Heading} from "../components/catalyst/heading.tsx";
import ThemeToggle from "../components/ThemeToggle.tsx";
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
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900 px-4">
            <ThemeToggle/>
            <div className="w-full max-w-sm">
                <Heading className="text-center mb-8">Jucosuma</Heading>

                {error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                        {error}
                    </div>
                )}

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
            </div>
        </div>
    );
}
