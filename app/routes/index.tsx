import { redirect } from "react-router"
import { requireUser } from "@/core/project-context/project-context.server"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types"

export async function loader({ context, request }: Route.LoaderArgs) {
	await requireUser({ context, request })
	return redirect(PATHS.SETUP)
}
