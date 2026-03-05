import { redirect } from "react-router"
import { getAuth } from "~/lib/auth/auth.server"
import type { Route } from "./+types/dashboard"

export async function loader({ context, request }: Route.LoaderArgs) {
	const auth = getAuth(context.cloudflare.env)

	const session = await auth.api.getSession({
		headers: request.headers,
	})

	if (!session?.user) {
		throw redirect("/")
	}

	return { user: session.user }
}

export async function action({ context, request }: Route.ActionArgs) {
	const auth = getAuth(context.cloudflare.env)
	const formData = await request.formData()
	const intent = formData.get("intent")
	if (intent === "logout") {
		const response = await auth.api.signOut({
			asResponse: true,
			headers: request.headers,
		})
		if (response.ok) {
			return redirect("/", { headers: response.headers })
		}
	}
}

export default function IndexRoute({ loaderData }: Route.ComponentProps) {
	return <div>Welcome, {loaderData.user.email}</div>
}
