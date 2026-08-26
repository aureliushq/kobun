import { PostHog } from "posthog-node"
import { createContext } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import type { Route } from "../+types/root"

export const posthogContext = createContext<PostHog | null>()

export const posthogMiddleware: Route.MiddlewareFunction = async (
	{ request, context },
	next,
) => {
	const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
	const host = import.meta.env.VITE_POSTHOG_HOST

	if (!token || !host) {
		if (import.meta.env.DEV) {
			console.error(
				"VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured",
			)
		}
		return next()
	}

	const posthog = new PostHog(token, {
		host,
		flushAt: 1,
		flushInterval: 0,
		enableExceptionAutocapture: true,
	})

	const sessionId = request.headers.get("X-POSTHOG-SESSION-ID")
	const session = await getAuth(context.get(envContext)).api.getSession({
		headers: request.headers,
	})
	const user = session?.user

	if (user) {
		posthog.identify({
			distinctId: user.id,
			properties: { name: user.name, email: user.email },
		})
	}

	context.set(posthogContext, posthog)

	const response = await posthog.withContext(
		{
			sessionId: sessionId ?? undefined,
			distinctId:
				user?.id ?? request.headers.get("X-POSTHOG-DISTINCT-ID") ?? undefined,
		},
		next,
	)

	await posthog.shutdown().catch(() => {})
	return response
}
