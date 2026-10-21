import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import {Description, Field, Label} from "../components/catalyst/fieldset.tsx";
import {categoryLabel} from "../utils/household.utils.ts";
import {Select} from "../components/catalyst/select.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {usePreferences} from "../stores/usePreferences.ts";
import {useAuth} from "../stores/useAuth.ts";
import {useEffect, useState} from "react";
import type {CategoryDto} from "../gen/types.gen.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {PlusIcon, TrashIcon} from "@heroicons/react/16/solid";
import {useTranslation} from "react-i18next";

export default function SettingsPage() {
    const {mainCurrency, setMainCurrency} = usePreferences();
    const {user, updateLanguage} = useAuth();
    const {t} = useTranslation();
    const isAdmin = user?.role === 'admin';

    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [newCatName, setNewCatName] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchCategories = async () => {
        const res = await apiFetch(`${apiBasePath}/categories`);
        if (res.ok) setCategories(await res.json());
    };

    useEffect(() => {
        if (isAdmin) fetchCategories();
    }, [isAdmin]);

    const addCategory = async () => {
        if (!newCatName.trim()) return;
        setLoading(true);
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0);
        await apiFetch(`${apiBasePath}/categories`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newCatName.trim(), sort_order: maxOrder + 1}),
        });
        setNewCatName('');
        setLoading(false);
        await fetchCategories();
    };

    const updateCategory = async (id: number, name: string, sortOrder: number) => {
        await apiFetch(`${apiBasePath}/categories/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, sort_order: sortOrder}),
        });
        await fetchCategories();
    };

    const deleteCategory = async (id: number) => {
        await apiFetch(`${apiBasePath}/categories/${id}`, {method: 'DELETE'});
        await fetchCategories();
    };

    return (
        <>
            <Heading>{t('settings.title')}</Heading>
            <Divider className="mt-4"/>

            <div className="mt-6 grid grid-cols-1 gap-6 max-w-md">
                <Field>
                    <Label>{t('settings.language')}</Label>
                    <Description>{t('settings.languageHint')}</Description>
                    <Select
                        value={user?.language ?? ''}
                        onChange={(e) => updateLanguage(e.target.value || null)}
                    >
                        <option value="">{t('settings.languageAuto')}</option>
                        <option value="de">Deutsch</option>
                        <option value="en">English</option>
                    </Select>
                </Field>
                <Field>
                    <Label>{t('settings.mainCurrency')}</Label>
                    <Select
                        value={mainCurrency}
                        onChange={(e) => setMainCurrency(e.target.value)}
                    >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CHF">CHF</option>
                    </Select>
                </Field>
            </div>

            {isAdmin && (
                <>
                    <Subheading className="mt-10">{t('settings.categories')}</Subheading>
                    <Divider className="mt-4"/>

                    <div className="mt-4 max-w-md">
                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder={t('settings.newCategory')}
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                className="flex-grow"
                            />
                            <Button onClick={addCategory} disabled={loading || !newCatName.trim()} className="hover:cursor-pointer">
                                <PlusIcon/>
                                {t('common.add')}
                            </Button>
                        </div>

                        <ul className="flex flex-col">
                            {categories.map((cat) => (
                                <li key={cat.id} className="flex items-center gap-2 py-2 border-b border-zinc-200 dark:border-zinc-800">
                                    <Input
                                        type="number"
                                        defaultValue={cat.sort_order}
                                        className="!w-14"
                                        min="0"
                                        onBlur={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            if (val !== cat.sort_order) {
                                                updateCategory(cat.id, cat.name, val);
                                            }
                                        }}
                                    />
                                    <span className="text-sm text-zinc-950 dark:text-white grow">
                                        {categoryLabel(cat.name, cat.key)}
                                        {cat.key && <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{t('settings.predefined')}</span>}
                                    </span>
                                    <Button plain onClick={() => deleteCategory(cat.id)} className="hover:cursor-pointer text-red-500">
                                        <TrashIcon className="size-4"/>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </>
    );
}
