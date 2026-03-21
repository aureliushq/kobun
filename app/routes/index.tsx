import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types"

export async function loader({ context, request }: Route.LoaderArgs) {
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	return redirect(PATHS.SETUP)
}
