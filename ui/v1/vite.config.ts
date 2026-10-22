import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {VitePWA} from 'vite-plugin-pwa'
import {version} from './package.json';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            // no offline cache: the app needs the API anyway and a precaching service worker kept
            // serving outdated builds. selfDestroying unregisters already installed workers and
            // clears their caches; the manifest stays so the app can still be added to the home screen.
            selfDestroying: true,
            manifest: {
                name: 'Jucosuma',
                short_name: 'Jucosuma',
                description: 'Just a Contract and Subscription Manager',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                icons: [
                    {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
                navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
            },
        }),
    ],
    define: {
        __APP_VERSION__: JSON.stringify(version),
    },
})
