// biome-ignore-all lint/security/noDangerouslySetInnerHtml: it's fine

import { usePostHog } from "@posthog/react"
import { useEffect, useRef } from "react"
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useRouteLoaderData,
} from "react-router"

import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { PreferencesContext } from "@/core/preferences/context"
import { dbContext } from "@/db/context"
import { DEFAULT_USER_PREFERENCES } from "@/db/types"
import { readUserPreferences } from "@/db/user-preference"
import { ThemeContext } from "@/ui/hooks/use-theme"
import { getThemeFromRequest, type Theme } from "@/ui/theme.server"
import type { Route } from "./+types/root"
import "@/core/styles/app.css"
import appConfig from "@/config/app"
import { posthogMiddleware } from "./lib/posthog-middleware"

export const middleware: Route.MiddlewareFunction[] = [posthogMiddleware]

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
]

export function meta() {
	return [
		{ title: appConfig.core.appTitle },
		{ name: "description", content: appConfig.core.appDescription },
		{ name: "keywords", content: appConfig.core.appKeywords },
	]
}

/**
 * Read here, and only here, because the Preferences reach five surfaces under
 * three different layouts — the sidebar, the editor, the Collection list, the
 * dashboard and every date Field. The save target above it is read in the
 * editor layout for the opposite reason: one consumer.
 *
 * One indexed row on top of a `getSession` this loader already awaits. Server
 * side rather than in the browser, so the stored value is in the first byte and
 * nothing paints a default and then corrects itself.
 *
 * A signed-out visitor gets the defaults. `/login` and `/setup` render before
 * there is a writer to look up, which is the same reason theme stays a cookie
 * (ADR-0010) — but unlike theme, nothing here needs an answer for them.
 */
export async function loader({ context, request }: Route.LoaderArgs) {
	const theme = getThemeFromRequest(request)
	const session = await getAuth(context.get(envContext)).api.getSession({
		headers: request.headers,
	})
	const preferences = session?.user
		? await readUserPreferences(context.get(dbContext), session.user.id)
		: DEFAULT_USER_PREFERENCES
	return { preferences, theme, user: session?.user ?? null }
}

function getThemeClass(theme: Theme) {
	if (theme === "dark") return "dark"
	return appConfig.core.darkMode ? "dark" : ""
}

const themeScript = `
(function() {
  var theme = document.documentElement.getAttribute("data-theme");
  var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
})();
`

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useRouteLoaderData<typeof loader>("root")
	const theme: Theme = data?.theme ?? "system"

	return (
		<html
			lang="en"
			data-theme={theme}
			className={getThemeClass(theme)}
			suppressHydrationWarning
		>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
				<link rel="canonical" href={appConfig.core.websiteUrl} />
				<Links />
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export default function App() {
	const { preferences, theme, user } = useLoaderData<typeof loader>()
	const posthog = usePostHog()
	const identifiedUserId = useRef<string | null>(null)

	useEffect(() => {
		if (user && identifiedUserId.current !== user.id) {
			posthog?.identify(user.id, { name: user.name, email: user.email })
			identifiedUserId.current = user.id
		}
	}, [posthog, user])

	return (
		<ThemeContext.Provider value={{ theme }}>
			<PreferencesContext.Provider value={preferences}>
				<Outlet />
			</PreferencesContext.Provider>
		</ThemeContext.Provider>
	)
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!"
	let details = "An unexpected error occurred."
	let stack: string | undefined

	const posthog = usePostHog()
	if (error instanceof Error) {
		posthog?.captureException(error)
	}

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error"
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message
		stack = error.stack
	}

	return (
		<main className="container mx-auto p-4 pt-16">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full overflow-x-auto p-4">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	)
}
