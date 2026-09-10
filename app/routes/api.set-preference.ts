import { data } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { parsePreferenceUpdate } from "@/core/settings/preference-update"
import { dbContext } from "@/db/context"
import { writeUserPreferences } from "@/db/user-preference"
import type { Route } from "./+types/api.set-preference"

/**
 * Save one Preference, from wherever its control is rendered.
 *
 * A route of its own rather than the `/settings` action, because a Preference
 * control is not confined to the account page: the sidebar's own rail changes
 * `sidebarOpen` from under the dashboard layout (#140), and a fetcher posts to
 * the route it is rendered in unless it is told otherwise. One handler for the
 * write, so a Preference cannot be validated one way here and another way there.
 *
 * The session is read here rather than taken from a Project Context — the same
 * three lines `api.set-editor-primary-action.ts` uses, and for the same reason:
 * this path names no Project. A status rather than a redirect, because the
 * caller is a fetcher and not a navigation.
 */
export async function action({ context, request }: Route.ActionArgs) {
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) return data({ success: false }, { status: 401 })

	const formData = await request.formData()
	const patch = parsePreferenceUpdate(formData)
	if (!patch) return data({ success: false }, { status: 400 })

	await writeUserPreferences(context.get(dbContext), session.user.id, patch)
	return data({ success: true })
}
