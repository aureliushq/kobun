import { useCallback } from "react"
import { useFetcher } from "react-router"
import {
	isPrimaryEditorAction,
	type PrimaryEditorAction,
} from "@/core/editor/primary-action"

export const SET_PRIMARY_ACTION_PATH = "/api/set-editor-primary-action"

/**
 * Which target the split control's primary button runs, and how to change it.
 *
 * The loader's value is the truth and the in-flight submission overrides it —
 * the same shape `useTheme` uses, and for the same reason: a `useState` seeded
 * from a loader goes stale the moment the loader revalidates, and then needs an
 * effect to un-stale it. `fetcher.formData` clears only once the loader has
 * re-read the row, so the label never flashes back to the old target on the way
 * through.
 */
export function usePrimaryEditorAction(fromLoader: PrimaryEditorAction) {
	const fetcher = useFetcher()
	const submitted = fetcher.formData?.get("action")
	const primaryAction = isPrimaryEditorAction(submitted)
		? submitted
		: fromLoader

	const setPrimaryAction = useCallback(
		(next: PrimaryEditorAction) => {
			fetcher.submit(
				{ action: next },
				{ action: SET_PRIMARY_ACTION_PATH, method: "POST" },
			)
		},
		[fetcher],
	)

	return { primaryAction, setPrimaryAction }
}
