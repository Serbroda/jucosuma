import {useEffect, type ReactNode} from "react";
import {Navigate} from "react-router";
import {useAuth} from "../stores/useAuth.ts";
import {useTranslation} from "react-i18next";

export default function AuthGuard({children}: { children: ReactNode }) {
    const {isAuthenticated, isLoading, user, checkAuth} = useAuth();
    const {t} = useTranslation();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-900">
                <div className="text-zinc-400 dark:text-zinc-500 text-sm">{t('common.loading')}</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    if (user?.must_change_password) {
        return <Navigate to="/change-password" replace/>;
    }

    return <>{children}</>;
}
