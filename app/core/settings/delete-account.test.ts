import { eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, test } from "vitest"
import type { ProjectContextDatabase } from "@/core/project-context/types"
import {
	collectionListing,
	editorDraft,
	githubInstallation,
	project,
	userInstallation,
	userPreference,
} from "@/db/schema/app-schema"
import { account, session, user } from "@/db/schema/auth-schema"
import { createInMemoryDb, type InMemoryDb } from "@/db/testing"
import { deleteAccount } from "./delete-account.server"

let close: InMemoryDb["close"]
let sqliteDb: InMemoryDb["db"]

// The schema is real and the cascades are the subject under test; only the
// driver differs from production, so the module keeps its exact D1 type.
function db() {
	return sqliteDb as unknown as ProjectContextDatabase
}

/** A writer with a Project, a Draft, a cached listing, a session and Preferences. */
function seedWriter(userId: string, repoId: string) {
	sqliteDb
		.insert(user)
		.values({ email: `${userId}@example.com`, id: userId, name: "Writer" })
		.run()
	sqliteDb
		.insert(userInstallation)
		.values({
			id: `link-${userId}`,
			installationId: "installation-1",
			userId,
		})
		.run()
	sqliteDb
		.insert(project)
		.values({
			configPath: ".kobun.json",
			configStatus: "present",
			id: `project-${userId}`,
			installationId: "installation-1",
			repoHtmlUrl: "https://github.com/writer/blog",
			repoId,
			repoName: "blog",
			repoOwnerLogin: "writer",
			status: "active",
			userId,
		})
		.run()
	sqliteDb
		.insert(editorDraft)
		.values({
			collectionSlug: "posts",
			id: `draft-${userId}`,
			projectId: `project-${userId}`,
			sourcePath: "content/posts/hello.md",
		})
		.run()
	sqliteDb
		.insert(collectionListing)
		.values({
			checkedAt: new Date(),
			directoryPath: "content/posts",
			entriesHash: "hash",
			items: "[]",
			projectId: `project-${userId}`,
		})
		.run()
	sqliteDb
		.insert(session)
		.values({
			expiresAt: new Date("2026-12-01T00:00:00Z"),
			id: `session-${userId}`,
			token: `token-${userId}`,
			userId,
		})
		.run()
	sqliteDb
		.insert(account)
		.values({
			accountId: `github-${userId}`,
			id: `account-${userId}`,
			providerId: "github",
			userId,
		})
		.run()
	sqliteDb.insert(userPreference).values({ userId }).run()
}

beforeEach(() => {
	const inMemory = createInMemoryDb()
	close = inMemory.close
	sqliteDb = inMemory.db

	sqliteDb
		.insert(githubInstallation)
		.values({
			githubInstallationId: "1",
			id: "installation-1",
			repositorySelection: "all",
			targetAvatarUrl: "https://github.com/writer.png",
			targetHtmlUrl: "https://github.com/writer",
			targetId: "100",
			targetLogin: "writer",
		})
		.run()

	seedWriter("user-1", "repo-1")
	seedWriter("user-2", "repo-2")
})

afterEach(() => {
	close()
})

function rowsFor(userId: string) {
	return {
		account: sqliteDb
			.select()
			.from(account)
			.where(eq(account.userId, userId))
			.all(),
		drafts: sqliteDb
			.select()
			.from(editorDraft)
			.where(eq(editorDraft.projectId, `project-${userId}`))
			.all(),
		installationLinks: sqliteDb
			.select()
			.from(userInstallation)
			.where(eq(userInstallation.userId, userId))
			.all(),
		listings: sqliteDb
			.select()
			.from(collectionListing)
			.where(eq(collectionListing.projectId, `project-${userId}`))
			.all(),
		preferences: sqliteDb
			.select()
			.from(userPreference)
			.where(eq(userPreference.userId, userId))
			.all(),
		projects: sqliteDb
			.select()
			.from(project)
			.where(eq(project.userId, userId))
			.all(),
		sessions: sqliteDb
			.select()
			.from(session)
			.where(eq(session.userId, userId))
			.all(),
		user: sqliteDb.select().from(user).where(eq(user.id, userId)).all(),
	}
}

test("deleting an account takes everything Kobun was holding for the writer", async () => {
	await deleteAccount(db(), "user-1")

	expect(rowsFor("user-1")).toEqual({
		account: [],
		drafts: [],
		installationLinks: [],
		listings: [],
		preferences: [],
		projects: [],
		sessions: [],
		user: [],
	})
})

test("the GitHub App installation outlives the writer who connected it", async () => {
	// Kobun cannot uninstall an App on the writer's behalf, and the row is
	// shared with everyone else who connected the same installation.
	await deleteAccount(db(), "user-1")

	expect(
		sqliteDb
			.select()
			.from(githubInstallation)
			.where(eq(githubInstallation.id, "installation-1"))
			.all(),
	).toHaveLength(1)
})

test("another writer sharing that installation is untouched", async () => {
	await deleteAccount(db(), "user-1")

	const other = rowsFor("user-2")
	expect(other.user).toHaveLength(1)
	expect(other.projects).toHaveLength(1)
	expect(other.drafts).toHaveLength(1)
	expect(other.listings).toHaveLength(1)
	expect(other.installationLinks).toHaveLength(1)
	expect(other.sessions).toHaveLength(1)
	expect(other.preferences).toHaveLength(1)
})

test("a writer who never connected anything can still delete their account", async () => {
	sqliteDb
		.insert(user)
		.values({ email: "new@example.com", id: "user-3", name: "New" })
		.run()

	await deleteAccount(db(), "user-3")

	expect(
		sqliteDb.select().from(user).where(eq(user.id, "user-3")).all(),
	).toEqual([])
})
