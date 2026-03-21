import {create} from 'zustand';
import type {UserDto} from '../gen/types.gen.ts';
import {apiBasePath} from '../config.ts';
import {apiFetch} from '../lib/fetch.ts';

export type AuthState = {
    user: UserDto | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    checkAuth: () => Promise<void>;
    login: (username: string, password: string) => Promise<UserDto>;
    logout: () => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    checkAuth: async () => {
        try {
            const res = await apiFetch(`${apiBasePath}/auth/me`);
            if (res.ok) {
                const user = await res.json();
                set({user, isAuthenticated: true, isLoading: false});
            } else {
                set({user: null, isAuthenticated: false, isLoading: false});
            }
        } catch {
            set({user: null, isAuthenticated: false, isLoading: false});
        }
    },

    login: async (username: string, password: string) => {
        const res = await apiFetch(`${apiBasePath}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password}),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({message: 'Login failed'}));
            throw new Error(err.message || 'Login failed');
        }
        const user = await res.json();
        set({user, isAuthenticated: true});
        return user;
    },

    logout: async () => {
        await apiFetch(`${apiBasePath}/auth/logout`, {method: 'POST'});
        set({user: null, isAuthenticated: false});
    },

    changePassword: async (currentPassword: string, newPassword: string) => {
        const res = await apiFetch(`${apiBasePath}/auth/change-password`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({current_password: currentPassword, new_password: newPassword}),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({message: 'Failed to change password'}));
            throw new Error(err.message || 'Failed to change password');
        }
        // Refresh user state
        const meRes = await apiFetch(`${apiBasePath}/auth/me`);
        if (meRes.ok) {
            const user = await meRes.json();
            set({user});
        }
    },
}));
