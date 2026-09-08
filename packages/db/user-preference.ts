import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "./schema"
import { userPreference } from "./schema/app-schema"
import {
	DateDisplay,
	EditorFont,
	EditorWidth,
	isDateDisplay,
	isEditorFont,
	isEditorWidth,
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
 * The Preferences a writer can change from the account page.
 *
 * Narrower than the row in two ways. The bookkeeping columns are not a writer's
 * business, and `editorPrimaryAction` is not on the account page at all: it is
 * still the editor's own cookie until #143 moves it, and offering two places to
 * set one thing is worse than offering none.
 *
 * The enum members are the point of restating the shape rather than deriving it
 * from `$inferSelect`. The columns are plain `text()`, so the row types them as
 * `string` — which is the truth about the storage and a lie about the value.
 */
export interface UserPreferenceValues {
	dateDisplay: DateDisplay
	editorFont: EditorFont
	editorWidth: EditorWidth
	/** Null means the writer has stated no preference; the reader falls back. */
	locale: string | null
	propertiesPanelOpen: boolean
	sidebarOpen: boolean
	/** Null means the writer has stated no preference; the reader falls back. */
	timezone: string | null
	wordCountVisible: boolean
}

/**
 * What a writer who has changed nothing gets.
 *
 * Deliberately a second spelling of the column defaults rather than a read of
 * them, because a writer with no row and a writer with a default row must come
 * out the same and only one of those has a row to read. `user-preference.test.ts`
 * asserts a freshly-inserted row equals this, which is what keeps the two
 * honest.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferenceValues = {
	dateDisplay: DateDisplay.RELATIVE,
	editorFont: EditorFont.SANS,
	editorWidth: EditorWidth.NORMAL,
	locale: null,
	propertiesPanelOpen: true,
	sidebarOpen: true,
	timezone: null,
	wordCountVisible: true,
}

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
