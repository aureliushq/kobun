import type { githubInstallation, project } from "./schema"

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

export type GithubInstallation = typeof githubInstallation.$inferSelect
export type Project = typeof project.$inferSelect

export type ProjectWithGithubInstallation = Project & {
	githubInstallation: GithubInstallation
}
