import type { githubInstallation, project, userPreference } from "./schema"

export enum RepositorySelection {
	ALL = "all",
	SELECTED = "selected",
}

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
 *
 * The save target has no enum here on purpose: `PrimaryEditorAction` in
 * `app/core/editor/primary-action.ts` already names that pair, and two names
 * for one vocabulary is worse than the import this package avoids.
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
 * The columns are plain `text()`, so nothing between a form field and the row
 * enforces these vocabularies — SQLite will store whatever it is handed. These
 * are where that enforcement lives, in the shape `isPrimaryEditorAction` in
 * `app/core/editor/primary-action.ts` already uses.
 *
 * They sit here rather than in a `.server` module because the guard is needed on
 * both sides: the settings page validates its own optimistic value in the
 * browser before the round trip settles. This module imports the schema with
 * `import type`, so reaching for it from the client costs nothing at runtime.
 */
export function isEditorWidth(value: unknown): value is EditorWidth {
	return Object.values(EditorWidth).includes(value as EditorWidth)
}

export function isEditorFont(value: unknown): value is EditorFont {
	return Object.values(EditorFont).includes(value as EditorFont)
}

export function isDateDisplay(value: unknown): value is DateDisplay {
	return Object.values(DateDisplay).includes(value as DateDisplay)
}

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
 *
 * It sits beside the guards rather than with `readUserPreferences` because the
 * browser needs it: every surface that renders a Preference falls back to these
 * when there is no signed-in writer to look one up for, and this module is the
 * half of `packages/db` that costs nothing to import from the client.
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

export type GithubInstallation = typeof githubInstallation.$inferSelect
export type Project = typeof project.$inferSelect
export type UserPreference = typeof userPreference.$inferSelect

export type ProjectWithGithubInstallation = Project & {
	githubInstallation: GithubInstallation
}
