import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { DEFAULT_USER_PREFERENCES, EditorWidth } from "@/db/types"
import { PreferencesContext, usePreferences } from "./context"

function Width() {
	return <span>{usePreferences().editorWidth}</span>
}

// The contract every untouched editor and Field test relies on: a component
// that reads a Preference renders under no provider at all, and renders what a
// writer who has changed nothing would see.
test("falls back to the defaults with no provider", () => {
	render(<Width />)
	expect(screen.getByText(DEFAULT_USER_PREFERENCES.editorWidth)).toBeVisible()
})

test("reads the writer's stored value when there is one", () => {
	render(
		<PreferencesContext.Provider
			value={{ ...DEFAULT_USER_PREFERENCES, editorWidth: EditorWidth.WIDE }}
		>
			<Width />
		</PreferencesContext.Provider>,
	)
	expect(screen.getByText(EditorWidth.WIDE)).toBeVisible()
})
