import { data } from "react-router"
import {
	isPrimaryEditorAction,
	serializePrimaryEditorActionCookie,
} from "@/core/editor/primary-action"
import type { Route } from "./+types/api.set-editor-primary-action"

/**
 * Remember which target the split control's primary button runs. A cookie
 * rather than a row, exactly as the theme is: it is one writer's preference
 * about their own chrome, and Kobun has no per-account settings to put it in.
 */
export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const primaryAction = formData.get("action")

	if (!isPrimaryEditorAction(primaryAction)) {
		return data({ success: false }, { status: 400 })
	}

	return data(
		{ success: true },
		{
			headers: {
				"Set-Cookie": serializePrimaryEditorActionCookie(primaryAction),
			},
		},
	)
}
