/** One row of the Active sessions list, with nothing on it that could sign anyone in. */
export interface SettingsSession {
	createdAt: Date
	/** The session making this request. It is listed, but never offered a Revoke. */
	current: boolean
	expiresAt: Date
	id: string
	ipAddress: string | null
	/** What the writer reads: "Chrome on macOS", or the raw agent when unknown. */
	label: string
}

/** The parts of a better-auth session row this list is built from. */
interface SessionRow {
	createdAt: Date
	expiresAt: Date
	id: string
	ipAddress?: string | null
	userAgent?: string | null
}

/**
 * The writer's sessions, in the shape the page renders.
 *
 * The projection is the point, not a convenience. `auth.api.listSessions`
 * returns whole rows, and a session row carries the `token` that *is* the
 * session — put one in a loader payload and every other device the writer owns
 * is in the page source. Revoking is keyed by `id` instead, and the action
 * looks the token up again server-side.
 *
 * Current session first, then newest, so the row a writer is least likely to
 * want to revoke is the one they read first and the rest are in the order they
 * happened.
 */
export function describeSessions(
	rows: SessionRow[],
	currentSessionId: string,
): SettingsSession[] {
	return rows
		.map((row) => ({
			createdAt: row.createdAt,
			current: row.id === currentSessionId,
			expiresAt: row.expiresAt,
			id: row.id,
			ipAddress: row.ipAddress ?? null,
			label: describeUserAgent(row.userAgent),
		}))
		.sort((a, b) => {
			if (a.current !== b.current) return a.current ? -1 : 1
			return b.createdAt.getTime() - a.createdAt.getTime()
		})
}

/**
 * Ordered because the strings nest: every Edge agent also says Chrome, every
 * Chrome agent also says Safari, and an Android agent also says Linux. First
 * match wins, so the more specific claim has to come first.
 */
const BROWSERS: [RegExp, string][] = [
	[/Edg[e/]/, "Edge"],
	[/OPR\/|Opera/, "Opera"],
	[/Firefox\//, "Firefox"],
	[/Chrome\//, "Chrome"],
	[/Safari\//, "Safari"],
]

const PLATFORMS: [RegExp, string][] = [
	[/Windows/, "Windows"],
	[/Android/, "Android"],
	[/iPhone|iPad|iPod/, "iOS"],
	[/Mac OS X|Macintosh/, "macOS"],
	[/Linux/, "Linux"],
]

/**
 * A user agent as something a writer can recognise their own laptop by.
 *
 * A display nicety and not device detection: nothing is decided on the answer,
 * so being wrong costs a confusing row rather than a wrong session revoked. An
 * agent it cannot read is handed back whole rather than called "Unknown" —
 * ugly beats useless when the writer is trying to tell two devices apart.
 */
export function describeUserAgent(
	userAgent: string | null | undefined,
): string {
	if (!userAgent) return "Unknown device"

	const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1]
	const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1]

	if (browser && platform) return `${browser} on ${platform}`
	return browser ?? platform ?? userAgent
}
