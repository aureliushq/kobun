declare const KOBUN_VERSION: string

// Build-time variables, inlined into the bundle by Vite from `.env` (locally) or
// from the Build step's environment (in CI). These are NOT Worker runtime
// bindings - see the `Env` interface in `worker-configuration.d.ts` for those.
//
// Typed as possibly-undefined on purpose: Vite substitutes `undefined` for a
// variable that wasn't set at build time, so every read needs a guard.
interface ImportMetaEnv {
	readonly VITE_KOBUN_HOME_URL: string | undefined
	readonly VITE_KOBUN_APP_URL: string | undefined
	readonly VITE_POSTHOG_PROJECT_TOKEN: string | undefined
	readonly VITE_POSTHOG_HOST: string | undefined
}
