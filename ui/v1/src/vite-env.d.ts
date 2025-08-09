/// <reference types="vite/client" />
declare const __APP_VERSION__: string;

interface ViteTypeOptions {
    // By adding this line, you can make the type of ImportMetaEnv strict
    // to disallow unknown keys.
    // strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
    readonly VITE_BACKEND_BASE_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
