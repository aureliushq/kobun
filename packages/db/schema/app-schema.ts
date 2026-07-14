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
		lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
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
		repoId: text("repo_id").notNull(),
		repoName: text("repo_name").notNull(),
		repoOwnerLogin: text("repo_owner_login").notNull(),
		repoHtmlUrl: text("repo_html_url").notNull(),
		configPath: text("config_path").notNull(),
		configStatus: text("config_status").notNull(),
		configCheckedAt: integer("config_checked_at", { mode: "timestamp_ms" }),
		configError: text("config_error"),
		configData: text("config_data"),
		configSha: text("config_sha"),
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
		uniqueIndex("project_userId_repoId_idx").on(table.userId, table.repoId),
		index("project_userId_idx").on(table.userId),
		index("project_installationId_idx").on(table.installationId),
		index("project_status_idx").on(table.status),
	],
)

export const editorDraft = sqliteTable(
	"editor_draft",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		collectionSlug: text("collection_slug").notNull(),
		itemSlug: text("item_slug"),
		sourcePath: text("source_path"),
		sourceSha: text("source_sha"),
		markdown: text("markdown").notNull().default(""),
		revision: integer("revision").notNull().default(0),
		publishedRevision: integer("published_revision"),
		publishedAt: integer("published_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("editor_draft_projectId_idx").on(table.projectId),
		index("editor_draft_projectId_collectionSlug_idx").on(
			table.projectId,
			table.collectionSlug,
		),
		uniqueIndex("editor_draft_projectId_sourcePath_idx").on(
			table.projectId,
			table.sourcePath,
		),
		index("editor_draft_publishedAt_idx").on(table.publishedAt),
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

export const projectRelations = relations(project, ({ many, one }) => ({
	user: one(user, {
		fields: [project.userId],
		references: [user.id],
	}),
	githubInstallation: one(githubInstallation, {
		fields: [project.installationId],
		references: [githubInstallation.id],
	}),
	editorDrafts: many(editorDraft),
}))

export const editorDraftRelations = relations(editorDraft, ({ one }) => ({
	project: one(project, {
		fields: [editorDraft.projectId],
		references: [project.id],
	}),
}))
