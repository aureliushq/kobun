import { useFetcher } from "react-router"
import type { UserPreferenceValues } from "@/db/types"

export const SET_PREFERENCE_PATH = "/api/set-preference"

type PreferenceKey = keyof UserPreferenceValues

/**
 * One Preference control, saving as the writer changes it.
 *
 * The loader's value is the truth and the in-flight submission overrides it —
 * the shape `useTheme` and `usePrimaryEditorAction` both use, and for the same
 * reason: a `useState` seeded from a loader goes stale the moment the loader
 * revalidates, and `fetcher.formData` clears only once the loader has re-read
 * the row, so a switch never flicks back on its way to being saved.
 *
 * A fetcher per Preference rather than one for the section. Two fetchers with
 * the same key share a submission, so flipping two switches quickly would leave
 * the first one wearing the second one's value.
 *
 * `decode` is total rather than a guard, because the string it is handed is the
 * one `encode` wrote a moment earlier. Validating it here would only re-check
 * this module's own work; the value is validated where it matters, on the way
 * into the row.
 *
 * The target is named rather than left to the fetcher's default, because a
 * Preference control is not confined to the account page — the sidebar changes
 * one from under the dashboard layout — and a fetcher with no `action` posts to
 * whichever route happens to be rendering it.
 */
export function usePreference<TValue extends boolean | string | null>({
	decode,
	name,
	value,
}: {
	decode(raw: string): TValue
	name: PreferenceKey
	value: TValue
}): {
	setValue(next: TValue): void
	value: TValue
} {
	const fetcher = useFetcher({ key: `preference:${name}` })

	const submitted = fetcher.formData?.get("value")
	const optimistic =
		typeof submitted === "string" ? decode(submitted) : undefined

	return {
		setValue(next) {
			fetcher.submit(
				{ key: name, value: encode(next) },
				{ action: SET_PREFERENCE_PATH, method: "POST" },
			)
		},
		value: optimistic === undefined ? value : optimistic,
	}
}

/** Null is "no preference stated", which a form field can only spell as empty. */
function encode(value: boolean | string | null): string {
	return value === null ? "" : String(value)
}
