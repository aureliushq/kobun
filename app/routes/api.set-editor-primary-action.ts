import { data } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { isPrimaryEditorAction } from "@/core/editor/primary-action"
import { dbContext } from "@/db/context"
import { writeEditorPrimaryAction } from "@/db/user-preference"
import type { Route } from "./+types/api.set-editor-primary-action"

/**
 * Remember which target the split control's primary button runs. A row rather
 * than a cookie: it is one writer's preference, and a preference that does not
 * follow them to their laptop is not really remembered (ADR-0010).
 *
 * The session is read here rather than taken from a Project Context — the same
 * three lines `routes/settings.tsx` uses, and for the same reason: this path
 * names no Project, so none of `project-context.server.ts`'s wrappers can
 * resolve one. A status rather than a redirect, because the caller is a fetcher
 * and not a navigation.
 */
export async function action({ context, request }: Route.ActionArgs) {
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) return data({ success: false }, { status: 401 })

	const formData = await request.formData()
	const primaryAction = formData.get("action")

	if (!isPrimaryEditorAction(primaryAction)) {
		return data({ success: false }, { status: 400 })
	}

	await writeEditorPrimaryAction(
		context.get(dbContext),
		session.user.id,
		primaryAction,
	)
	return data({ success: true })
}
