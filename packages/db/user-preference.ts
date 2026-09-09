import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "./schema"
import { userPreference } from "./schema/app-schema"
import {
	DEFAULT_USER_PREFERENCES,
	isDateDisplay,
	isEditorFont,
	isEditorWidth,
	type UserPreferenceValues,
} from "./types"

/**
 * Production runs on D1; tests run the same schema on in-memory SQLite and cast
 * to this type. The cast holds as long as this module sticks to plain queries —
 * never `.batch()` or `.transaction()`, which differ between the drivers. The
 * same bargain `app/core/project-context/types.ts` strikes, spelt out again
 * rather than imported: `packages/db` does not depend on `app`.
 */
type UserPreferenceDatabase = DrizzleD1Database<typeof schema>

/**
 * The writer's Preferences, with the defaults standing in for anything they
 * have not set.
 *
 * A missing row is the ordinary case, not an error: a row is written the first
 * time a writer changes something, and most never will. A stored value outside
 * its vocabulary falls back to the default too — SQLite does not enforce these,
 * so a page that trusted the string could render a width that does not exist.
 */
export async function readUserPreferences(
	db: UserPreferenceDatabase,
	userId: string,
): Promise<UserPreferenceValues> {
	const row = await db.query.userPreference.findFirst({
		where: eq(userPreference.userId, userId),
	})
	if (!row) return DEFAULT_USER_PREFERENCES

	return {
		dateDisplay: isDateDisplay(row.dateDisplay)
			? row.dateDisplay
			: DEFAULT_USER_PREFERENCES.dateDisplay,
		editorFont: isEditorFont(row.editorFont)
			? row.editorFont
			: DEFAULT_USER_PREFERENCES.editorFont,
		editorWidth: isEditorWidth(row.editorWidth)
			? row.editorWidth
			: DEFAULT_USER_PREFERENCES.editorWidth,
		locale: row.locale,
		propertiesPanelOpen: row.propertiesPanelOpen,
		sidebarOpen: row.sidebarOpen,
		timezone: row.timezone,
		wordCountVisible: row.wordCountVisible,
	}
}

/**
 * Write one or more Preferences onto the writer's row, creating it if this is
 * the first thing they have ever changed.
 *
 * An upsert rather than an update, for that reason — the same shape
 * `routes/setup.tsx` uses to record an installation it may or may not have seen
 * before. The insert carries the defaults for everything the patch leaves out,
 * so a partial write never invents values the writer did not choose.
 */
export async function writeUserPreferences(
	db: UserPreferenceDatabase,
	userId: string,
	patch: Partial<UserPreferenceValues>,
): Promise<void> {
	await db
		.insert(userPreference)
		.values({ ...DEFAULT_USER_PREFERENCES, ...patch, userId })
		.onConflictDoUpdate({
			set: patch,
			target: userPreference.userId,
		})
}
