import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/api.dashboard-actions"

export async function action({ context, request }: Route.ActionArgs) {
	const response = await getAuth(context.get(envContext)).api.signOut({
		asResponse: true,
		headers: request.headers,
	})
	return redirect(PATHS.LOGIN, { headers: response.headers })
}
