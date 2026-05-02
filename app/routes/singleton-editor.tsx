import { useParams } from "react-router"
import { EditorActionIntents } from "@/ui/lib/types"
import type { Route } from "./+types/singleton-editor"

export async function loader(_args: Route.LoaderArgs) {
	return {}
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const intent = formData.get("intent")

	switch (intent) {
		case EditorActionIntents.SAVE:
			// TODO: implement save
			return { ok: true, intent }
		case EditorActionIntents.PUBLISH:
			// TODO: implement publish
			return { ok: true, intent }
		default:
			return { ok: false, error: "unknown intent" }
	}
}

export default function SingletonEditor() {
	const params = useParams()
	const slug = params.singleton_slug

	return (
		<div className="p-6">
			<p className="text-muted-foreground text-sm">Editor for "{slug}"</p>
		</div>
	)
}
