import {useEffect, useState} from "react";
import {PlusIcon, TrashIcon} from "@heroicons/react/16/solid";
import {useTranslation} from "react-i18next";
import {Heading, Subheading} from "../components/catalyst/heading.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Select} from "../components/catalyst/select.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Text} from "../components/catalyst/text.tsx";
import {Checkbox, CheckboxField} from "../components/catalyst/checkbox.tsx";
import {Label} from "../components/catalyst/fieldset.tsx";
import {AccountTypeDepot, AccountTypeSavings} from "../gen/types.gen.ts";
import {AccountTypeChecking, type AccountDto, type PersonDto, type UserOptionDto} from "../gen/types.gen.ts";
import {accountTypes} from "../utils/household.utils.ts";
import {useAuth} from "../stores/useAuth.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {saveAccount} from "../lib/accounts.ts";
import {card} from "../utils/ui.ts";

const jsonHeaders = {'Content-Type': 'application/json'};

export default function HouseholdPage() {
    const {t} = useTranslation();
    const {user} = useAuth();
    const [persons, setPersons] = useState<PersonDto[]>([]);
    const [accounts, setAccounts] = useState<AccountDto[]>([]);
    const [logins, setLogins] = useState<UserOptionDto[]>([]);
    const [error, setError] = useState('');
    const [newPersonName, setNewPersonName] = useState('');
    const [newPersonExternal, setNewPersonExternal] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');

    const fetchAll = async () => {
        const [p, a, u] = await Promise.all([
            apiFetch(`${apiBasePath}/persons`),
            apiFetch(`${apiBasePath}/accounts`),
            apiFetch(`${apiBasePath}/user_options`),
        ]);
        if (p.ok) setPersons(await p.json());
        if (a.ok) setAccounts(await a.json());
        if (u.ok) setLogins(await u.json());
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handle = async (res: Response) => {
        setError(res.ok ? '' : (await res.json().catch(() => ({}))).message ?? res.statusText);
        await fetchAll();
    };

    const savePerson = async (person: Partial<PersonDto>) => {
        const res = await apiFetch(person.id ? `${apiBasePath}/persons/${person.id}` : `${apiBasePath}/persons`, {
            method: person.id ? 'PUT' : 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
                name: person.name,
                in_household: person.in_household,
                user_id: person.user_id ?? null,
                sort_order: person.sort_order ?? 0,
            }),
        });
        await handle(res);
    };

    const remove = async (path: string) => {
        await handle(await apiFetch(`${apiBasePath}/${path}`, {method: 'DELETE'}));
    };

    const addPerson = async () => {
        if (!newPersonName.trim()) return;
        await savePerson({name: newPersonName.trim(), in_household: !newPersonExternal, sort_order: persons.length});
        setNewPersonName('');
    };

    const addAccount = async () => {
        if (!newAccountName.trim()) return;
        await handle(await saveAccount({name: newAccountName.trim(), type: AccountTypeChecking, sort_order: accounts.length}));
        setNewAccountName('');
    };

    const loginTaken = (loginId: number, personId: number) =>
        persons.some((p) => p.id !== personId && p.user_id === loginId);

    const personRow = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] sm:grid-cols-[minmax(0,1fr)_10rem_12rem_2.5rem] items-center gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800";
    const accountRow = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] sm:grid-cols-[minmax(0,1fr)_14rem_10rem_6rem_2.5rem] items-center gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800";

    return (
        <>
            <Heading>{t('household.title')}</Heading>

            {error && (
                <div className="mt-4 max-w-2xl rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            <Subheading className="mt-8">{t('household.persons')}</Subheading>
            <Text className="mt-1">{t('household.personsText')}</Text>
            <div className={card + " mt-4 max-w-4xl"}>
                <ul className="flex flex-col">
                    {persons.map((p) => (
                        <li key={p.id} className={personRow}>
                            <Input
                                defaultValue={p.name}
                                aria-label={t('common.name')}
                                className="col-span-3 sm:col-span-1"
                                onBlur={(e) => e.target.value.trim() && e.target.value !== p.name
                                    && savePerson({...p, name: e.target.value.trim()})}
                            />
                            <Select
                                value={p.in_household ? 'household' : 'external'}
                                aria-label={t('household.membership')}
                                onChange={(e) => savePerson({...p, in_household: e.target.value === 'household'})}
                            >
                                <option value="household">{t('household.member')}</option>
                                <option value="external">{t('household.external')}</option>
                            </Select>
                            <Select
                                value={p.user_id ?? ''}
                                aria-label={t('household.login')}
                                onChange={(e) => savePerson({...p, user_id: e.target.value ? Number(e.target.value) : undefined})}
                            >
                                <option value="">{t('household.noLogin')}</option>
                                {logins.map((l) => (
                                    <option key={l.id} value={l.id} disabled={loginTaken(l.id, p.id)}>
                                        {l.username}{l.id === user?.id ? ` ${t('household.you')}` : ''}
                                    </option>
                                ))}
                            </Select>
                            <Button plain onClick={() => remove(`persons/${p.id}`)} className="hover:cursor-pointer text-red-500"
                                    aria-label={t('household.deleteItem', {name: p.name})}>
                                <TrashIcon className="size-4"/>
                            </Button>
                        </li>
                    ))}
                </ul>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-4">
                    <Input
                        placeholder={t('household.personPlaceholder')}
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                        className="grow min-w-40"
                    />
                    <Select
                        value={newPersonExternal ? 'external' : 'household'}
                        aria-label={t('household.membership')}
                        onChange={(e) => setNewPersonExternal(e.target.value === 'external')}
                    >
                        <option value="household">{t('household.member')}</option>
                        <option value="external">{t('household.external')}</option>
                    </Select>
                    <Button onClick={addPerson} disabled={!newPersonName.trim()} className="hover:cursor-pointer">
                        <PlusIcon/>
                        {t('common.add')}
                    </Button>
                </div>
            </div>

            <Subheading className="mt-12">{t('household.accounts')}</Subheading>
            <Text className="mt-1">{t('household.accountsText')}</Text>
            <div className={card + " mt-4 max-w-4xl"}>
                <ul className="flex flex-col">
                    {accounts.map((a) => (
                        <li key={a.id} className={accountRow}>
                            <Input
                                defaultValue={a.name}
                                aria-label={t('household.accountName')}
                                className="col-span-3 sm:col-span-1"
                                onBlur={async (e) => e.target.value.trim() && e.target.value !== a.name
                                    && handle(await saveAccount({...a, name: e.target.value.trim()}))}
                            />
                            <Select
                                value={a.type}
                                aria-label={t('household.accountType')}
                                onChange={async (e) => handle(await saveAccount({
                                    ...a,
                                    type: e.target.value,
                                    is_savings: e.target.value === AccountTypeSavings || e.target.value === AccountTypeDepot
                                        ? true : a.is_savings,
                                }))}
                            >
                                {accountTypes().map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </Select>
                            <Select
                                value={a.person_id ?? ''}
                                aria-label={t('household.owner')}
                                onChange={async (e) => handle(await saveAccount({
                                    ...a,
                                    person_id: e.target.value ? Number(e.target.value) : undefined,
                                }))}
                            >
                                <option value="">{t('common.shared')}</option>
                                {persons.filter((p) => p.in_household).map((p) =>
                                    <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                            <CheckboxField className="col-span-2 sm:col-span-1">
                                <Checkbox
                                    checked={a.is_savings}
                                    onChange={async (checked) => handle(await saveAccount({...a, is_savings: checked}))}
                                />
                                <Label>{t('household.isSavings')}</Label>
                            </CheckboxField>
                            <Button plain onClick={() => remove(`accounts/${a.id}`)} className="hover:cursor-pointer text-red-500"
                                    aria-label={t('household.deleteItem', {name: a.name})}>
                                <TrashIcon className="size-4"/>
                            </Button>
                        </li>
                    ))}
                </ul>
                <div className="flex gap-2 mt-4">
                    <Input
                        placeholder={t('household.accountPlaceholder')}
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addAccount()}
                        className="grow"
                    />
                    <Button onClick={addAccount} disabled={!newAccountName.trim()} className="hover:cursor-pointer">
                        <PlusIcon/>
                        {t('common.add')}
                    </Button>
                </div>
            </div>
        </>
    );
}
