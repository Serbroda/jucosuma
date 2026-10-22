import {defineConfig} from 'vitest/config'

// Unit tests for the calculation logic (src/**/*.test.ts). Separate from vite.config.ts so the
// PWA and React plugins are not involved.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        setupFiles: ['src/test/setup.ts'],
    },
})
