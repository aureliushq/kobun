import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/dashboard"

export async function loader({ context, request }: Route.LoaderArgs) {
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	return { user: session.user }
}

export async function action({ context, request }: Route.ActionArgs) {
	const auth = getAuth(context.get(envContext))
	const formData = await request.formData()
	const intent = formData.get("intent")
	if (intent === "logout") {
		const response = await auth.api.signOut({
			asResponse: true,
			headers: request.headers,
		})
		if (response.ok) {
			return redirect(PATHS.LOGIN, { headers: response.headers })
		}
	}
}

export default function IndexRoute({ loaderData }: Route.ComponentProps) {
	return <div>Welcome, {loaderData.user.email}</div>
}
