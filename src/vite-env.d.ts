/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ENABLE_VISION_API_FALLBACK?: string;
  readonly VITE_VISION_FALLBACK_URL?: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_AI_ENDPOINT?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_PAYSTACK_PUBLIC_KEY?: string;
  readonly VITE_FLUTTERWAVE_PUBLIC_KEY?: string;
  readonly VITE_ENABLE_PHASE_1?: string;
  readonly VITE_ENABLE_PHASE_2?: string;
  readonly VITE_ENABLE_PHASE_3?: string;
  readonly VITE_ENABLE_PHASE_4?: string;
  readonly VITE_ENABLE_PHASE_5?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
