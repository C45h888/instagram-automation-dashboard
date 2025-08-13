/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string
    readonly VITE_WEBHOOK_URL: string
    readonly VITE_META_APP_ID: string
    readonly VITE_META_APP_SECRET: string
    readonly VITE_WEBHOOK_VERIFY_TOKEN: string
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }