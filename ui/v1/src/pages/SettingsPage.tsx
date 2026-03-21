import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
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

export default function SettingsPage() {
    const {mainCurrency, setMainCurrency} = usePreferences();
    const {user} = useAuth();
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

    const deleteCategory = async (id: number) => {
        await apiFetch(`${apiBasePath}/categories/${id}`, {method: 'DELETE'});
        await fetchCategories();
    };

    return (
        <>
            <Heading>Settings</Heading>
            <Divider className="mt-4"/>

            <div className="mt-6 grid grid-cols-1 gap-6 max-w-md">
                <Field>
                    <Label>Main Currency</Label>
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
                    <Subheading className="mt-10">Categories</Subheading>
                    <Divider className="mt-4"/>

                    <div className="mt-4 max-w-md">
                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder="New category name"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                className="flex-grow"
                            />
                            <Button onClick={addCategory} disabled={loading || !newCatName.trim()} className="hover:cursor-pointer">
                                <PlusIcon/>
                                Add
                            </Button>
                        </div>

                        <ul className="flex flex-col">
                            {categories.map((cat) => (
                                <li key={cat.id} className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                                    <span className="text-sm text-zinc-950 dark:text-white">{cat.name}</span>
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
