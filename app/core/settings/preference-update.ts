import { isDateDisplay, isEditorFont, isEditorWidth } from "@/db/types"
import type { UserPreferenceValues } from "@/db/user-preference"

/**
 * Read one Preference change off a submitted form.
 *
 * One control, one value: the account page saves as the writer changes things
 * rather than behind a Save button, the way the theme and save-target controls
 * already behave. So a submission carries a `key` and a `value` and never a
 * whole form, and this turns that pair into the patch `writeUserPreferences`
 * takes.
 *
 * Null means the submission named a Preference that does not exist, or a value
 * that Preference cannot hold — the caller's cue to refuse rather than to
 * guess. Nothing here reaches the row without passing its own vocabulary's
 * guard, because the columns are plain `text()` and SQLite would take anything.
 *
 * Pure, and deliberately not a `.server` module: it holds no secret, and the
 * action is easier to trust when the part worth testing is not behind a
 * request.
 */
export function parsePreferenceUpdate(
	formData: FormData,
): Partial<UserPreferenceValues> | null {
	const key = formData.get("key")
	const value = formData.get("value")
	if (typeof key !== "string" || typeof value !== "string") return null

	switch (key) {
		case "propertiesPanelOpen":
		case "sidebarOpen":
		case "wordCountVisible": {
			if (value !== "true" && value !== "false") return null
			return { [key]: value === "true" }
		}
		case "dateDisplay":
			return isDateDisplay(value) ? { dateDisplay: value } : null
		case "editorFont":
			return isEditorFont(value) ? { editorFont: value } : null
		case "editorWidth":
			return isEditorWidth(value) ? { editorWidth: value } : null
		case "locale":
			return parseLocale(value)
		case "timezone":
			return parseTimezone(value)
		default:
			return null
	}
}

/**
 * An empty value is how the writer says "no preference" — the option both
 * controls open with — and null is how the column spells that.
 */
function parseLocale(value: string): Partial<UserPreferenceValues> | null {
	if (value === "") return { locale: null }
	try {
		const [canonical] = Intl.getCanonicalLocales(value)
		return canonical ? { locale: canonical } : null
	} catch {
		// `getCanonicalLocales` throws on a malformed tag rather than returning.
		return null
	}
}

function parseTimezone(value: string): Partial<UserPreferenceValues> | null {
	if (value === "") return { timezone: null }
	try {
		// Cheaper than searching `Intl.supportedValuesOf("timeZone")`, and it is
		// the same list: an unknown zone throws here.
		new Intl.DateTimeFormat(undefined, { timeZone: value })
		return { timezone: value }
	} catch {
		return null
	}
}
