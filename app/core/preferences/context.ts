import { createContext, useContext } from "react"
import { DEFAULT_USER_PREFERENCES, type UserPreferenceValues } from "@/db/types"

/**
 * The writer's Preferences, as every surface that renders one reads them.
 *
 * Filled from the root loader, so a Preference is in the server-rendered HTML
 * and no page paints a default before correcting itself.
 *
 * Unlike `ThemeContext`, the default is the defaults rather than `undefined`,
 * and reading it outside a provider is not an error. Two callers need that: a
 * signed-out page has no row to read, and the editor and Field components are
 * rendered directly by their own tests, which are about the Field and not about
 * whose Preferences it was rendered under.
 */
export const PreferencesContext = createContext<UserPreferenceValues>(
	DEFAULT_USER_PREFERENCES,
)

export function usePreferences(): UserPreferenceValues {
	return useContext(PreferencesContext)
}
