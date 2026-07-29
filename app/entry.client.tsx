import { PostHogProvider } from "@posthog/react"
import posthog from "posthog-js"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { HydratedRouter } from "react-router/dom"

const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
const host = import.meta.env.VITE_POSTHOG_HOST

if (token && host) {
	posthog.init(token, {
		api_host: host,
		defaults: "2026-01-30",
		tracing_headers: [window.location.hostname],
	})
} else if (import.meta.env.DEV) {
	console.error(
		"VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured",
	)
}

startTransition(() => {
	hydrateRoot(
		document,
		<PostHogProvider client={posthog}>
			<StrictMode>
				<HydratedRouter />
			</StrictMode>
		</PostHogProvider>,
	)
})
