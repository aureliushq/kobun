import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "./schema"

/**
 * Production runs on D1; tests run the same schema on in-memory SQLite and cast
 * to this type. The cast holds as long as callers stick to plain queries:
 * never call `.batch()` or `.transaction()`, which differ between the drivers.
 */
export type Database = DrizzleD1Database<typeof schema>

export enum ConfigStatus {
	UNKNOWN = "unknown",
	PRESENT = "present",
	MISSING = "missing",
	ERROR = "error",
	TOO_LARGE = "too_large",
}

export enum ProjectStatus {
	ACTIVE = "active",
	DISCONNECTED = "disconnected",
	ARCHIVED = "archived",
}

/**
 * The vocabularies `userPreference`'s text columns hold. Declared here rather
 * than as `text({ enum })` in the schema, the way `ConfigStatus` and
 * `ProjectStatus` are: SQLite does not enforce them either way, so one place to
 * read them beats two places to change them.
 *
 * `NORMAL` and `SANS` are the editor as it renders today — a single 42rem
 * column in `packages/editor/styles/editor.css`, and the app's `--font-sans`.
 */
export enum EditorWidth {
	NARROW = "narrow",
	NORMAL = "normal",
	WIDE = "wide",
}

export enum EditorFont {
	SANS = "sans",
	SERIF = "serif",
	MONO = "mono",
}

export enum DateDisplay {
	RELATIVE = "relative",
	ABSOLUTE = "absolute",
}

/**
 * Which of the two targets the editor header's split control runs when the
 * writer presses its primary button.
 *
 * A pair of literals rather than an enum, because they are
 * `EditorActionIntents`' own values and the header's `EditorAction` compares
 * against them as plain strings. Publish is a separate button and never a
 * primary, because it means something else entirely (ADR-0008).
 */
const PRIMARY_EDITOR_ACTIONS = ["save", "commit"] as const
export type PrimaryEditorAction = (typeof PRIMARY_EDITOR_ACTIONS)[number]

/**
 * The columns are plain `text()`, so nothing between a form field and the row
 * enforces these vocabularies — SQLite will store whatever it is handed. These
 * are where that enforcement lives.
 *
 * They sit here rather than in a `.server` module because the guard is needed on
 * both sides: the settings page validates its own optimistic value in the
 * browser before the round trip settles. This module imports the schema with
 * `import type`, so reaching for it from the client costs nothing at runtime.
 */
export function isEnumValue<T extends Record<string, string>>(
	values: T,
	value: unknown,
): value is T[keyof T] {
	return Object.values(values).includes(value as T[keyof T])
}

export function isPrimaryEditorAction(
	value: unknown,
): value is PrimaryEditorAction {
	return PRIMARY_EDITOR_ACTIONS.includes(value as PrimaryEditorAction)
}

/**
 * The Preferences a writer can change.
 *
 * Narrower than the row: the bookkeeping columns are not a writer's business.
 * Not every one is on the account page — `editorPrimaryAction` is chosen from
 * the editor's split control, and offering two places to set one thing is worse
 * than offering one.
 *
 * The enum members are the point of restating the shape rather than deriving it
 * from `$inferSelect`. The columns are plain `text()`, so the row types them as
 * `string` — which is the truth about the storage and a lie about the value.
 */
export interface UserPreferenceValues {
	dateDisplay: DateDisplay
	editorFont: EditorFont
	editorPrimaryAction: PrimaryEditorAction
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
 *
 * It sits beside the guards rather than with `readUserPreferences` because the
 * browser needs it: every surface that renders a Preference falls back to these
 * when there is no signed-in writer to look one up for, and this module is the
 * half of `packages/db` that costs nothing to import from the client.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferenceValues = {
	dateDisplay: DateDisplay.RELATIVE,
	editorFont: EditorFont.SANS,
	// Save, because a default is a decision made on somebody's behalf and this is
	// the one where being wrong costs nothing: a Draft is private, reversible, and
	// already being written by autosave. Save to GitHub puts a commit in a shared
	// history under the writer's own GitHub identity.
	editorPrimaryAction: "save",
	editorWidth: EditorWidth.NORMAL,
	locale: null,
	propertiesPanelOpen: true,
	sidebarOpen: true,
	timezone: null,
	wordCountVisible: true,
}

export type GithubInstallation = typeof schema.githubInstallation.$inferSelect
export type Project = typeof schema.project.$inferSelect

export type ProjectWithGithubInstallation = Project & {
	githubInstallation: GithubInstallation
}
