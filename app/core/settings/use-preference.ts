import { useFetcher } from "react-router"
import type { UserPreferenceValues } from "@/db/user-preference"
import { SettingsActionIntents } from "@/ui/lib/types"

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
				{
					intent: SettingsActionIntents.UPDATE_PREFERENCE,
					key: name,
					value: encode(next),
				},
				{ method: "POST" },
			)
		},
		value: optimistic === undefined ? value : optimistic,
	}
}

/** Null is "no preference stated", which a form field can only spell as empty. */
function encode(value: boolean | string | null): string {
	return value === null ? "" : String(value)
}
