import { AlertCircleIcon } from "lucide-react"
import { data, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { deleteAccount } from "@/core/settings/delete-account.server"
import { DeleteAccountSection } from "@/core/settings/delete-account-section"
import { parsePreferenceUpdate } from "@/core/settings/preference-update"
import { PreferencesSection } from "@/core/settings/preferences-section"
import { ProfileSection } from "@/core/settings/profile-section"
import { describeSessions } from "@/core/settings/sessions"
import { SessionsSection } from "@/core/settings/sessions-section"
import { dbContext } from "@/db/context"
import { readUserPreferences, writeUserPreferences } from "@/db/user-preference"
import { posthogContext } from "@/lib/posthog-middleware"
import { Alert, AlertDescription } from "@/ui/components/base/alert"
import { PATHS } from "@/ui/lib/constants"
import { SettingsActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/settings"

/**
 * The account settings page: profile, Preferences, sessions and deletion.
 *
 * The session is read here rather than taken from the layout, which publishes
 * only its back link — the same three lines `routes/index.tsx` and
 * `routes/setup.tsx` use, and for the same reason: `/settings` has no Project in
 * its URL, so none of `project-context.server.ts`'s wrappers can resolve one
 * (ADR-0010).
 *
 * Everything is awaited. `listSessions` is a read of the writer's own rows,
 * about the weight of the Projects query the layout already waits for, so
 * ADR-0006's case for streaming does not apply.
 *
 * Every Preference stored here is read back where it applies — the sidebar, the
 * editor, the Collection list and every date Field — from the single read in
 * `app/root.tsx`, so a change lands on the next page load rather than here.
 */
export async function loader({ context, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const [preferences, sessions] = await Promise.all([
		readUserPreferences(db, session.user.id),
		auth.api.listSessions({ headers: request.headers }),
	])

	return {
		preferences,
		sessions: describeSessions(sessions, session.session.id),
		user: {
			email: session.user.email,
			image: session.user.image ?? null,
			name: session.user.name,
		},
	}
}

export async function action({ context, request }: Route.ActionArgs) {
	const db = context.get(dbContext)
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const formData = await request.formData()
	const intent = formData.get("intent")

	if (intent === SettingsActionIntents.UPDATE_PREFERENCE) {
		const patch = parsePreferenceUpdate(formData)
		if (!patch) {
			throw new Response("Unknown preference", { status: 400 })
		}
		await writeUserPreferences(db, session.user.id, patch)
		return { ok: true }
	}

	if (intent === SettingsActionIntents.REVOKE_SESSION) {
		const sessionId = formData.get("sessionId")
		if (typeof sessionId !== "string") {
			throw new Response("Session ID is required", { status: 400 })
		}
		if (sessionId === session.session.id) {
			// Revoking the session making the request would sign the writer out
			// of the page they are standing on, which is signing out wearing
			// another name. The list offers no Revoke for this row; a submission
			// that names it anyway did not come from the page.
			throw new Response("Cannot revoke the current session", { status: 400 })
		}

		// The list is already scoped to this writer, so finding the row here is
		// both the ownership check and the way to the token — which is why the
		// page was never given one.
		const sessions = await auth.api.listSessions({ headers: request.headers })
		const target = sessions.find((row) => row.id === sessionId)
		if (!target) {
			// Reachable rather than defensive: the page holds the list it was
			// loaded with, so a session revoked from another tab — or expired
			// since — is still on screen with a button under it. That is a thing
			// to tell the writer, not an error boundary to throw them into.
			return data({ error: "That session had already ended." }, { status: 404 })
		}
		await auth.api.revokeSession({
			body: { token: target.token },
			headers: request.headers,
		})
		return { ok: true }
	}

	if (intent === SettingsActionIntents.DELETE_ACCOUNT) {
		const confirmation = formData.get("confirmation")
		if (
			typeof confirmation !== "string" ||
			confirmation.trim().toLowerCase() !== session.user.email.toLowerCase()
		) {
			return data(
				{ error: "That is not the email address on this account." },
				{ status: 400 },
			)
		}

		context.get(posthogContext)?.capture({ event: "account_deleted" })
		await deleteAccount(db, session.user.id)

		// The rows the session cookie points at are gone; this is what tells the
		// browser to stop sending it.
		const response = await auth.api.signOut({
			asResponse: true,
			headers: request.headers,
		})
		return redirect(PATHS.LOGIN, { headers: response.headers })
	}

	throw new Response("Unknown settings action", { status: 400 })
}

const Settings = ({ actionData, loaderData }: Route.ComponentProps) => {
	const { preferences, sessions, user } = loaderData

	return (
		<>
			<h1 className="font-semibold text-2xl">Settings</h1>
			{actionData && "error" in actionData ? (
				<Alert variant="destructive">
					<AlertCircleIcon />
					<AlertDescription>{actionData.error}</AlertDescription>
				</Alert>
			) : null}
			<ProfileSection user={user} />
			<PreferencesSection preferences={preferences} />
			<SessionsSection sessions={sessions} />
			<DeleteAccountSection email={user.email} />
		</>
	)
}

export default Settings
