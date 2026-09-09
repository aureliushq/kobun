import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
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
}
