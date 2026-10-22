import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowDownTrayIcon, ArrowUpTrayIcon} from "@heroicons/react/20/solid";
import PageHeader from "../components/ui/PageHeader.tsx";
import ImportDialog from "../components/ImportDialog.tsx";
import BackupSettingsCard from "../components/BackupSettingsCard.tsx";
import NotificationServerCard from "../components/NotificationServerCard.tsx";
import {Description, Field, Label} from "../components/catalyst/fieldset.tsx";
import {Select} from "../components/catalyst/select.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {usePreferences} from "../stores/usePreferences.ts";
import {useAuth} from "../stores/useAuth.ts";
import {apiBasePath} from "../config.ts";
import {card, cardTitle} from "../utils/ui.ts";

export default function SettingsPage() {
    const {mainCurrency, setMainCurrency, theme, setTheme} = usePreferences();
    const {user, updateLanguage} = useAuth();
    const {t} = useTranslation();
    const [showImport, setShowImport] = useState(false);

    return (
        <div className="flex flex-col gap-6 max-w-3xl">
            <ImportDialog isOpen={showImport} onClose={() => setShowImport(false)}/>
            <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')}/>

            <div className={card}>
                <div className={cardTitle + " mb-4"}>{t('settings.personal')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Field>
                        <Label>{t('settings.language')}</Label>
                        <Description>{t('settings.languageHint')}</Description>
                        <Select value={user?.language ?? ''} onChange={(e) => updateLanguage(e.target.value || null)}>
                            <option value="">{t('settings.languageAuto')}</option>
                            <option value="de">Deutsch</option>
                            <option value="en">English</option>
                        </Select>
                    </Field>
                    <Field>
                        <Label>{t('settings.theme')}</Label>
                        <Description>{t('settings.deviceHint')}</Description>
                        <Select value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")}>
                            <option value="light">{t('nav.lightMode')}</option>
                            <option value="dark">{t('nav.darkMode')}</option>
                        </Select>
                    </Field>
                    <Field>
                        <Label>{t('settings.mainCurrency')}</Label>
                        <Description>{t('settings.deviceHint')}</Description>
                        <Select value={mainCurrency} onChange={(e) => setMainCurrency(e.target.value)}>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                            <option value="CHF">CHF</option>
                        </Select>
                    </Field>
                </div>
            </div>

            {user?.role === 'admin' && <NotificationServerCard/>}
            {user?.role === 'admin' && <BackupSettingsCard/>}

            <div className={card}>
                <div className={cardTitle}>{t('settings.data')}</div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">{t('settings.dataHint')}</p>
                <div className="flex flex-wrap gap-2">
                    <Button outline onClick={() => setShowImport(true)} className="hover:cursor-pointer">
                        <ArrowUpTrayIcon/>{t('export.import')}
                    </Button>
                    <Button outline href={`${apiBasePath}/contracts/export.csv`} download>
                        <ArrowDownTrayIcon/>{t('settings.exportCsv')}
                    </Button>
                    <Button outline href={`${apiBasePath}/contracts/export.json`} download>
                        <ArrowDownTrayIcon/>{t('settings.exportJson')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
