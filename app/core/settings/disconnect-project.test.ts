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
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb, type InMemoryDb } from "@/db/testing"
import { disconnectProject } from "./disconnect-project.server"

/**
 * Disconnecting one Project (#137).
 *
 * The schema is the subject: what a single `DELETE FROM project` takes with it,
 * and what it must leave standing. `delete-account.test.ts` asks the same
 * question of every Project at once.
 */

let close: InMemoryDb["close"]
let sqliteDb: InMemoryDb["db"]

// Only the driver differs from production, so the module keeps its D1 type.
function db() {
	return sqliteDb as unknown as ProjectContextDatabase
}

/** A Project with a Draft and a cached Collection listing. */
function seedProject(projectId: string, userId: string, repoId: string) {
	sqliteDb
		.insert(project)
		.values({
			configPath: ".kobun.json",
			configStatus: "present",
			id: projectId,
			installationId: "installation-1",
			repoHtmlUrl: `https://github.com/writer/${repoId}`,
			repoId,
			repoName: repoId,
			repoOwnerLogin: "writer",
			status: "active",
			userId,
		})
		.run()
	sqliteDb
		.insert(editorDraft)
		.values({
			collectionSlug: "posts",
			id: `draft-${projectId}`,
			projectId,
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
			projectId,
		})
		.run()
}

function seedWriter(userId: string) {
	sqliteDb
		.insert(user)
		.values({ email: `${userId}@example.com`, id: userId, name: "Writer" })
		.run()
	sqliteDb
		.insert(userInstallation)
		.values({ id: `link-${userId}`, installationId: "installation-1", userId })
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

	seedWriter("user-1")
	seedWriter("user-2")
	seedProject("project-1", "user-1", "blog")
	seedProject("project-2", "user-1", "notes")
	seedProject("project-3", "user-2", "docs")
})

afterEach(() => {
	close()
})

function rowsFor(projectId: string) {
	return {
		drafts: sqliteDb
			.select()
			.from(editorDraft)
			.where(eq(editorDraft.projectId, projectId))
			.all(),
		listings: sqliteDb
			.select()
			.from(collectionListing)
			.where(eq(collectionListing.projectId, projectId))
			.all(),
		projects: sqliteDb
			.select()
			.from(project)
			.where(eq(project.id, projectId))
			.all(),
	}
}

test("disconnecting takes the Project's Drafts and cached listings with it", async () => {
	await disconnectProject(db(), "project-1")

	expect(rowsFor("project-1")).toEqual({
		drafts: [],
		listings: [],
		projects: [],
	})
})

test("the writer's other Projects are untouched", async () => {
	await disconnectProject(db(), "project-1")

	const other = rowsFor("project-2")
	expect(other.projects).toHaveLength(1)
	expect(other.drafts).toHaveLength(1)
	expect(other.listings).toHaveLength(1)
})

test("another writer's Project is untouched", async () => {
	await disconnectProject(db(), "project-1")

	expect(rowsFor("project-3").projects).toHaveLength(1)
})

test("the writer, their Preferences and their installation link all survive", async () => {
	await disconnectProject(db(), "project-1")

	expect(
		sqliteDb.select().from(user).where(eq(user.id, "user-1")).all(),
	).toHaveLength(1)
	expect(
		sqliteDb
			.select()
			.from(userPreference)
			.where(eq(userPreference.userId, "user-1"))
			.all(),
	).toHaveLength(1)
	expect(
		sqliteDb
			.select()
			.from(userInstallation)
			.where(eq(userInstallation.userId, "user-1"))
			.all(),
	).toHaveLength(1)
})

test("the GitHub App installation outlives the Project that used it", async () => {
	// Kobun cannot uninstall an App on the writer's behalf, and the row is
	// shared with everyone else who connected the same installation.
	await disconnectProject(db(), "project-1")

	expect(
		sqliteDb
			.select()
			.from(githubInstallation)
			.where(eq(githubInstallation.id, "installation-1"))
			.all(),
	).toHaveLength(1)
})
