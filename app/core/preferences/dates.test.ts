import { describe, expect, test } from "vitest"
import { DateDisplay, DEFAULT_USER_PREFERENCES } from "@/db/types"
import {
	formatDate,
	formatDatetime,
	formatDay,
	formatTimestamp,
	fromWallTime,
	toWallTime,
} from "./dates"

/** 2026-07-14T15:45:00Z — a Tuesday afternoon in UTC, midnight-ish in Tokyo. */
const INSTANT = new Date("2026-07-14T15:45:00Z")

function preferences(overrides: Partial<typeof DEFAULT_USER_PREFERENCES> = {}) {
	return { ...DEFAULT_USER_PREFERENCES, ...overrides }
}

describe("formatTimestamp", () => {
	test("says how long ago when the writer asked for distances", () => {
		const anHourAgo = new Date(Date.now() - 60 * 60 * 1000)
		expect(formatTimestamp(anHourAgo, preferences())).toMatch(/ago$/)
	})

	test("spells the moment out when the writer asked for dates", () => {
		const shown = formatTimestamp(
			INSTANT,
			preferences({
				dateDisplay: DateDisplay.ABSOLUTE,
				locale: "en-GB",
				timezone: "UTC",
			}),
		)
		expect(shown).toContain("14 Jul 2026")
		expect(shown).toContain("15:45")
	})

	test("spells it in the writer's language", () => {
		const german = formatTimestamp(
			INSTANT,
			preferences({
				dateDisplay: DateDisplay.ABSOLUTE,
				locale: "de-DE",
				timezone: "UTC",
			}),
		)
		expect(german).toContain("14.07.2026")
	})

	test("spells it in the writer's zone, not the machine's", () => {
		const tokyo = formatTimestamp(
			INSTANT,
			preferences({
				dateDisplay: DateDisplay.ABSOLUTE,
				locale: "en-GB",
				timezone: "Asia/Tokyo",
			}),
		)
		// 15:45 UTC is half past midnight the next morning in Tokyo.
		expect(tokyo).toContain("15 Jul 2026")
		expect(tokyo).toContain("00:45")
	})
})

describe("formatDay", () => {
	// A calendar day is not an instant. Reading `2026-07-14` in a zone behind
	// UTC would otherwise render the 13th — the day nobody wrote down.
	test("names the same day wherever the writer is", () => {
		const day = new Date("2026-07-14")
		const east = formatDay(day, preferences({ timezone: "Pacific/Auckland" }))
		const west = formatDay(
			day,
			preferences({ timezone: "America/Los_Angeles" }),
		)
		expect(east).toBe(west)
		expect(east).toContain("2026")
		expect(east).toContain("14")
	})

	test("names it in the writer's language", () => {
		const day = new Date("2026-07-14")
		expect(formatDay(day, preferences({ locale: "en-GB" }))).toBe("14 Jul 2026")
		expect(formatDay(day, preferences({ locale: "en-US" }))).toBe(
			"Jul 14, 2026",
		)
	})
})

describe("formatDate", () => {
	test("says how long ago when the writer asked for distances", () => {
		expect(formatDate(new Date("2020-01-01"), preferences())).toMatch(/ago$/)
	})

	// The bug this function exists to avoid: an absolute reading through the
	// instant formatter would print a midnight nobody wrote, against the day
	// before it in any zone behind UTC.
	test("names the day, with no time and no zone shift", () => {
		const shown = formatDate(
			new Date("2026-07-14"),
			preferences({
				dateDisplay: DateDisplay.ABSOLUTE,
				locale: "en-GB",
				timezone: "America/Los_Angeles",
			}),
		)
		expect(shown).toBe("14 Jul 2026")
	})
})

describe("formatDatetime", () => {
	// Unlike a date, a datetime is never shown as a distance: the time of day is
	// the whole reason the Field Type exists.
	test("ignores the relative preference and shows the time", () => {
		const shown = formatDatetime(
			INSTANT,
			preferences({
				dateDisplay: DateDisplay.RELATIVE,
				locale: "en-GB",
				timezone: "UTC",
			}),
		)
		expect(shown).toContain("14 Jul 2026")
		expect(shown).toContain("15:45")
	})
})

describe("wall time", () => {
	test("reads an instant as the clock reads it in a zone", () => {
		expect(toWallTime(INSTANT, "UTC")).toBe("2026-07-14T15:45:00")
		expect(toWallTime(INSTANT, "Asia/Tokyo")).toBe("2026-07-15T00:45:00")
		expect(toWallTime(INSTANT, "America/Los_Angeles")).toBe(
			"2026-07-14T08:45:00",
		)
	})

	test("spells midnight as 00, not 24", () => {
		const midnight = new Date("2026-07-14T00:00:00Z")
		expect(toWallTime(midnight, "UTC")).toBe("2026-07-14T00:00:00")
	})

	test("turns a clock reading back into the instant it names", () => {
		expect(
			fromWallTime("2026-07-15T00:45:00", "Asia/Tokyo").toISOString(),
		).toBe(INSTANT.toISOString())
		expect(
			fromWallTime("2026-07-14T08:45:00", "America/Los_Angeles").toISOString(),
		).toBe(INSTANT.toISOString())
	})

	// The offset used to find an instant is not always the offset in force at
	// it: an hour either side of a clock change, one pass lands in the wrong one.
	test("round-trips across a daylight saving change", () => {
		const before = new Date("2026-03-08T06:30:00Z") // 01:30 EST
		const after = new Date("2026-03-08T07:30:00Z") // 03:30 EDT
		for (const instant of [before, after]) {
			const wall = toWallTime(instant, "America/New_York")
			expect(fromWallTime(wall, "America/New_York").toISOString()).toBe(
				instant.toISOString(),
			)
		}
	})

	test("hands back an invalid date rather than guessing at junk", () => {
		expect(Number.isNaN(fromWallTime("not a time", "UTC").getTime())).toBe(true)
	})
})
