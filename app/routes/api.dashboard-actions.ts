import { and, eq } from "drizzle-orm"
import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { syncProjectConfig } from "@/config/github.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema"
import { PATHS } from "@/ui/lib/constants"
import { DashboardActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/api.dashboard-actions"

export async function action({ context, request }: Route.ActionArgs) {
	const env = context.get(envContext)
	const auth = getAuth(env)

	const formData = await request.formData()
	const intent = formData.get("intent")

	if (intent === DashboardActionIntents.LOGOUT) {
		const response = await auth.api.signOut({
			asResponse: true,
			headers: request.headers,
		})
		return redirect(PATHS.LOGIN, { headers: response.headers })
	}

	if (intent === DashboardActionIntents.REFRESH_CONFIGURATION) {
		const db = context.get(dbContext)

		const session = await auth.api.getSession({ headers: request.headers })
		if (!session?.user) throw redirect(PATHS.LOGIN)

		const owner = formData.get("owner") as string
		const name = formData.get("name") as string
		if (!owner || !name)
			throw new Response("Missing owner or name", { status: 400 })

		const activeProject = await db.query.project.findFirst({
			where: and(
				eq(project.userId, session.user.id),
				eq(project.repoOwnerLogin, owner),
				eq(project.repoName, name),
			),
		})
		if (!activeProject) throw redirect(PATHS.SETUP)

		const updatedProject = await syncProjectConfig(db, env, activeProject)

		return { activeProject: updatedProject }
	}
}
