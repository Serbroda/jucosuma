import {useEffect, useState} from "react";
import {Heading} from "../components/catalyst/heading.tsx";
import {Divider} from "../components/catalyst/divider.tsx";
import {Button} from "../components/catalyst/button.tsx";
import {Badge} from "../components/catalyst/badge.tsx";
import {Field, Label} from "../components/catalyst/fieldset.tsx";
import {Input} from "../components/catalyst/input.tsx";
import {Select} from "../components/catalyst/select.tsx";
import {PlusIcon, TrashIcon, KeyIcon} from "@heroicons/react/16/solid";
import type {UserDto} from "../gen/types.gen.ts";
import {apiBasePath} from "../config.ts";
import {apiFetch} from "../lib/fetch.ts";
import {useAuth} from "../stores/useAuth.ts";
import ConfirmDialog from "../components/dialogs/ConfirmDialog.tsx";

export default function UsersPage() {
    const {user: currentUser} = useAuth();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('user');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [resetPasswordId, setResetPasswordId] = useState<number | null>(null);
    const [resetPassword, setResetPassword] = useState('');

    const fetchUsers = async () => {
        const res = await apiFetch(`${apiBasePath}/users`);
        if (res.ok) setUsers(await res.json());
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await apiFetch(`${apiBasePath}/users`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: newUsername, password: newPassword, role: newRole}),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({message: 'Failed to create user'}));
                throw new Error(err.message || 'Failed to create user');
            }
            setShowAddForm(false);
            setNewUsername('');
            setNewPassword('');
            setNewRole('user');
            await fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        await apiFetch(`${apiBasePath}/users/${id}`, {method: 'DELETE'});
        setConfirmDelete(null);
        await fetchUsers();
    };

    const handleResetPassword = async (id: number) => {
        if (resetPassword.length < 8) return;
        await apiFetch(`${apiBasePath}/users/${id}/reset-password`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({password: resetPassword}),
        });
        setResetPasswordId(null);
        setResetPassword('');
    };

    return (
        <>
            <ConfirmDialog
                isOpen={confirmDelete !== null}
                title="Delete User"
                message="Are you sure you want to delete this user?"
                submitLabel="Delete"
                cancelLabel="Cancel"
                onClose={() => setConfirmDelete(null)}
                onSubmit={async () => {
                    if (confirmDelete) await handleDelete(confirmDelete);
                }}
            />

            <div className="flex items-center justify-between">
                <Heading>Users</Heading>
                <Button onClick={() => setShowAddForm(!showAddForm)} className="hover:cursor-pointer">
                    <PlusIcon/>
                    Add User
                </Button>
            </div>
            <Divider className="mt-4 mb-6"/>

            {error && (
                <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400 mb-4">
                    {error}
                </div>
            )}

            {showAddForm && (
                <form onSubmit={handleCreate} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 mb-6 flex flex-col gap-3">
                    <div className="text-sm font-medium text-zinc-950 dark:text-white">New User</div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <Field>
                            <Label>Username</Label>
                            <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoFocus/>
                        </Field>
                        <Field>
                            <Label>Password</Label>
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/>
                        </Field>
                        <Field>
                            <Label>Role</Label>
                            <Select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </Select>
                        </Field>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={loading} className="hover:cursor-pointer">
                            {loading ? 'Creating...' : 'Create'}
                        </Button>
                        <Button type="button" outline onClick={() => setShowAddForm(false)} className="hover:cursor-pointer">
                            Cancel
                        </Button>
                    </div>
                </form>
            )}

            <ul className="flex flex-col">
                {users.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 p-3 border-b border-zinc-200 dark:border-zinc-800">
                        <div className="flex flex-col grow min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-950 dark:text-white">{u.username}</span>
                                <Badge color={u.role === 'admin' ? 'amber' : 'zinc'} className="text-xs">{u.role}</Badge>
                            </div>
                        </div>

                        {resetPasswordId === u.id ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="password"
                                    placeholder="New password (min 8)"
                                    value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    className="!w-48"
                                    autoFocus
                                />
                                <Button onClick={() => handleResetPassword(u.id)} disabled={resetPassword.length < 8} className="hover:cursor-pointer">
                                    Set
                                </Button>
                                <Button outline onClick={() => {setResetPasswordId(null); setResetPassword('');}} className="hover:cursor-pointer">
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex gap-1">
                                <Button plain onClick={() => setResetPasswordId(u.id)} className="hover:cursor-pointer">
                                    <KeyIcon className="size-4"/>
                                </Button>
                                {currentUser?.id !== u.id && u.username !== 'admin' && (
                                    <Button plain onClick={() => setConfirmDelete(u.id)} className="hover:cursor-pointer text-red-500">
                                        <TrashIcon className="size-4"/>
                                    </Button>
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}
