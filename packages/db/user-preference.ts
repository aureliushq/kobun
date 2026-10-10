import { eq } from "drizzle-orm"
import { userPreference } from "./schema/app-schema"
import {
	type Database,
	DateDisplay,
	DEFAULT_USER_PREFERENCES,
	EditorFont,
	EditorWidth,
	isEnumValue,
	isPrimaryEditorAction,
	type UserPreferenceValues,
} from "./types"

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
	db: Database,
	userId: string,
): Promise<UserPreferenceValues> {
	const row = await db.query.userPreference.findFirst({
		where: eq(userPreference.userId, userId),
	})
	if (!row) return DEFAULT_USER_PREFERENCES

	return {
		dateDisplay: isEnumValue(DateDisplay, row.dateDisplay)
			? row.dateDisplay
			: DEFAULT_USER_PREFERENCES.dateDisplay,
		editorFont: isEnumValue(EditorFont, row.editorFont)
			? row.editorFont
			: DEFAULT_USER_PREFERENCES.editorFont,
		editorPrimaryAction: isPrimaryEditorAction(row.editorPrimaryAction)
			? row.editorPrimaryAction
			: DEFAULT_USER_PREFERENCES.editorPrimaryAction,
		editorWidth: isEnumValue(EditorWidth, row.editorWidth)
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
	db: Database,
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
