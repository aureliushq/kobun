import { relations, sql } from "drizzle-orm"
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { user } from "./auth-schema"

export const githubInstallation = sqliteTable(
	"github_installation",
	{
		id: text("id").primaryKey(),
		githubInstallationId: text("github_installation_id").notNull().unique(),
		targetId: text("target_id").notNull(),
		targetLogin: text("target_login").notNull(),
		targetAvatarUrl: text("target_avatar_url").notNull(),
		targetHtmlUrl: text("target_html_url").notNull(),
		repositorySelection: text("repository_selection").notNull(),
		suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
		deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("github_installation_githubInstallationId_idx").on(
			table.githubInstallationId,
		),
		index("github_installation_targetLogin_idx").on(table.targetLogin),
		index("github_installation_deletedAt_idx").on(table.deletedAt),
		index("github_installation_suspendedAt_idx").on(table.suspendedAt),
	],
)

export const userInstallation = sqliteTable(
	"user_installation",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		installationId: text("installation_id")
			.notNull()
			.references(() => githubInstallation.id),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("user_installation_userId_installationId_idx").on(
			table.userId,
			table.installationId,
		),
		index("user_installation_userId_idx").on(table.userId),
		index("user_installation_installationId_idx").on(table.installationId),
	],
)

export const project = sqliteTable(
	"project",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		installationId: text("installation_id")
			.notNull()
			.references(() => githubInstallation.id),
		githubRepoId: text("github_repo_id").notNull(),
		repoName: text("repo_name").notNull(),
		repoOwnerLogin: text("repo_owner_login").notNull(),
		repoHtmlUrl: text("repo_html_url").notNull(),
		configPath: text("config_path").notNull(),
		configStatus: text("config_status").notNull(),
		status: text("status").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("project_userId_githubRepoId_idx").on(
			table.userId,
			table.githubRepoId,
		),
		index("project_userId_idx").on(table.userId),
		index("project_installationId_idx").on(table.installationId),
		index("project_status_idx").on(table.status),
	],
)

export const githubInstallationRelations = relations(
	githubInstallation,
	({ many }) => ({
		userInstallations: many(userInstallation),
		projects: many(project),
	}),
)

export const userInstallationRelations = relations(
	userInstallation,
	({ one }) => ({
		user: one(user, {
			fields: [userInstallation.userId],
			references: [user.id],
		}),
		githubInstallation: one(githubInstallation, {
			fields: [userInstallation.installationId],
			references: [githubInstallation.id],
		}),
	}),
)

export const projectRelations = relations(project, ({ one }) => ({
	user: one(user, {
		fields: [project.userId],
		references: [user.id],
	}),
	githubInstallation: one(githubInstallation, {
		fields: [project.installationId],
		references: [githubInstallation.id],
	}),
}))
