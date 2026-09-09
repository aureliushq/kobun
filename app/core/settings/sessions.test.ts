import { expect, test } from "vitest"
import { describeSessions, describeUserAgent } from "./sessions"

const CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const SAFARI_IOS =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const FIREFOX_LINUX =
	"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0"
const EDGE_WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"

function row(
	overrides: Partial<Parameters<typeof describeSessions>[0][number]> = {},
) {
	return {
		createdAt: new Date("2026-01-01T00:00:00Z"),
		expiresAt: new Date("2026-02-01T00:00:00Z"),
		id: "session-1",
		ipAddress: "203.0.113.7",
		token: "secret-token",
		userAgent: CHROME_MAC,
		...overrides,
	}
}

test("a writer reads their devices by name, not by user agent", () => {
	expect(describeUserAgent(CHROME_MAC)).toBe("Chrome on macOS")
	expect(describeUserAgent(SAFARI_IOS)).toBe("Safari on iOS")
	expect(describeUserAgent(FIREFOX_LINUX)).toBe("Firefox on Linux")
	// Every Edge agent also claims Chrome, and every Chrome agent also claims
	// Safari. The more specific claim has to win.
	expect(describeUserAgent(EDGE_WINDOWS)).toBe("Edge on Windows")
})

test("an agent nobody recognises is shown whole rather than called unknown", () => {
	expect(describeUserAgent("kobun-cli/1.0")).toBe("kobun-cli/1.0")
	expect(describeUserAgent(null)).toBe("Unknown device")
	expect(describeUserAgent("")).toBe("Unknown device")
})

test("no session token reaches the page", () => {
	const [session] = describeSessions([row()], "session-1")

	expect(session).not.toHaveProperty("token")
	expect(JSON.stringify(session)).not.toContain("secret-token")
})

test("the writer can tell which session is the one they are reading on", () => {
	const sessions = describeSessions(
		[row({ id: "other" }), row({ id: "here" })],
		"here",
	)

	expect(sessions.map((session) => [session.id, session.current])).toEqual([
		["here", true],
		["other", false],
	])
})

test("the rest are listed newest first", () => {
	const sessions = describeSessions(
		[
			row({ createdAt: new Date("2026-01-01T00:00:00Z"), id: "old" }),
			row({ createdAt: new Date("2026-03-01T00:00:00Z"), id: "new" }),
			row({ createdAt: new Date("2026-02-01T00:00:00Z"), id: "here" }),
		],
		"here",
	)

	expect(sessions.map((session) => session.id)).toEqual(["here", "new", "old"])
})

test("a session better-auth recorded no address for still lists", () => {
	const [session] = describeSessions(
		[row({ ipAddress: null, userAgent: null })],
		"session-1",
	)

	expect(session).toMatchObject({ ipAddress: null, label: "Unknown device" })
})
