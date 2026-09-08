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

export type GithubInstallation = typeof githubInstallation.$inferSelect
export type Project = typeof project.$inferSelect
export type UserPreference = typeof userPreference.$inferSelect

export type ProjectWithGithubInstallation = Project & {
	githubInstallation: GithubInstallation
}
