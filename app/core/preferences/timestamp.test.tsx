import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { DateDisplay, DEFAULT_USER_PREFERENCES } from "@/db/types"
import { PreferencesContext } from "./context"
import { Timestamp } from "./timestamp"

const INSTANT = new Date("2026-07-14T15:45:00Z")

function shown(overrides: Partial<typeof DEFAULT_USER_PREFERENCES>) {
	render(
		<PreferencesContext.Provider
			value={{
				...DEFAULT_USER_PREFERENCES,
				locale: "en-GB",
				timezone: "UTC",
				...overrides,
			}}
		>
			<Timestamp value={INSTANT} />
		</PreferencesContext.Provider>,
	)
	return document.querySelector("span") as HTMLSpanElement
}

// The distance is quick to scan and says nothing about which day, so the day
// hangs off it rather than making the reader open the item to find it.
test("hangs the exact stamp off a distance", () => {
	const span = shown({ dateDisplay: DateDisplay.RELATIVE })
	expect(span.textContent).toMatch(/ago$/)
	expect(span.title).toBe("14 Jul 2026, 15:45:00 UTC")
})

// No label names a zone, so the tooltip always has something left to say —
// even here, where the stamp itself is already on the page.
test("names the zone even when the stamp is already on the page", () => {
	const span = shown({ dateDisplay: DateDisplay.ABSOLUTE })
	expect(span.textContent).toBe("14 Jul 2026, 15:45")
	expect(span.title).toBe("14 Jul 2026, 15:45:00 UTC")
})

test("keeps the class it was handed", () => {
	render(
		<PreferencesContext.Provider value={DEFAULT_USER_PREFERENCES}>
			<Timestamp className="text-xs" value={INSTANT} />
		</PreferencesContext.Provider>,
	)
	expect(screen.getByText(/ago$/)).toHaveClass("text-xs")
})
