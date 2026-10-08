import {
	cpSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { afterEach, beforeEach, expect, test } from "vitest"
import {
	editorDraft,
	githubInstallation,
	project,
} from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb, type InMemoryDb } from "@/db/testing"

/**
 * Whose Draft a row is, as the migrated schema enforces it: a Collection's or a
 * Singleton's, and a Subcollection's only as a Collection's with both its
 * Parent Item and Subcollection named (#182).
 */

let inMemory: InMemoryDb
let drafts = 0

beforeEach(() => {
	inMemory = createInMemoryDb()
	const { db } = inMemory
	db.insert(user)
		.values({ email: "writer@example.com", id: "user-1", name: "Writer" })
		.run()
	db.insert(githubInstallation)
		.values({
			githubInstallationId: "1",
			id: "installation-1",
			repositorySelection: "all",
			targetAvatarUrl: "https://example.com/avatar.png",
			targetHtmlUrl: "https://github.com/acme",
			targetId: "1",
			targetLogin: "acme",
		})
		.run()
	db.insert(project)
		.values({
			configPath: "kobun.config.ts",
			configStatus: "valid",
			id: "project-1",
			installationId: "installation-1",
			repoHtmlUrl: "https://github.com/acme/blog",
			repoId: "1",
			repoName: "blog",
			repoOwnerLogin: "acme",
			status: "active",
			userId: "user-1",
		})
		.run()
})

afterEach(() => {
	inMemory.close()
})

function insert(owner: Partial<typeof editorDraft.$inferInsert>) {
	return () =>
		inMemory.db
			.insert(editorDraft)
			.values({ id: `draft-${++drafts}`, projectId: "project-1", ...owner })
			.run()
}

test("a Draft is a Collection's, a Singleton's, or a Subcollection's", () => {
	expect(insert({ collectionSlug: "projects" })).not.toThrow()
	expect(insert({ singletonSlug: "about" })).not.toThrow()
	expect(
		insert({
			collectionSlug: "projects",
			parentItem: "acme",
			subcollectionKey: "updates",
		}),
	).not.toThrow()
})

test("a Subcollection's Draft names both its Parent Item and its Subcollection", () => {
	expect(insert({ collectionSlug: "projects", parentItem: "acme" })).toThrow(
		/CHECK/,
	)
	expect(
		insert({ collectionSlug: "projects", subcollectionKey: "updates" }),
	).toThrow(/CHECK/)
})

test("only a Collection's Draft can be a Subcollection's", () => {
	expect(
		insert({
			parentItem: "acme",
			singletonSlug: "about",
			subcollectionKey: "updates",
		}),
	).toThrow(/CHECK/)
	expect(insert({ parentItem: "acme", subcollectionKey: "updates" })).toThrow(
		/CHECK/,
	)
})

const MIGRATIONS_FOLDER = join(
	dirname(fileURLToPath(import.meta.url)),
	"migrations",
)

/**
 * The checked-in migrations as they stood before a tag: the folder copied, its
 * journal cut short, so a database can be stood up at that point and the rest
 * applied over rows it already holds.
 */
function migrationsBefore(tag: string) {
	const folder = mkdtempSync(join(tmpdir(), "kobun-migrations-"))
	cpSync(MIGRATIONS_FOLDER, folder, { recursive: true })
	const journalPath = join(folder, "meta", "_journal.json")
	const journal = JSON.parse(readFileSync(journalPath, "utf8"))
	const cut = journal.entries.findIndex(
		(entry: { tag: string }) => entry.tag === tag,
	)
	journal.entries = journal.entries.slice(0, cut)
	writeFileSync(journalPath, JSON.stringify(journal))
	return folder
}

// The table is rebuilt to widen its CHECK, so every Draft held before has to
// come across unchanged — and as nobody's Subcollection Draft.
test("Drafts held before the migration keep their owner", () => {
	const sqlite = new Database(":memory:")
	const db = drizzle(sqlite)
	const before = migrationsBefore("0011_draft_subcollection_owner")
	try {
		migrate(db, { migrationsFolder: before })
		sqlite.exec(`
			INSERT INTO user (id, name, email) VALUES ('user-1', 'Writer', 'writer@example.com');
			INSERT INTO github_installation (id, github_installation_id, target_id, target_login, target_avatar_url, target_html_url, repository_selection)
				VALUES ('installation-1', '1', '1', 'acme', 'https://example.com/a.png', 'https://github.com/acme', 'all');
			INSERT INTO project (id, user_id, installation_id, repo_id, repo_name, repo_owner_login, repo_html_url, config_path, config_status, status)
				VALUES ('project-1', 'user-1', 'installation-1', '1', 'blog', 'acme', 'https://github.com/acme/blog', 'kobun.config.ts', 'valid', 'active');
			INSERT INTO editor_draft (id, project_id, collection_slug) VALUES ('posts-draft', 'project-1', 'posts');
			INSERT INTO editor_draft (id, project_id, singleton_slug) VALUES ('about-draft', 'project-1', 'about');
		`)

		migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

		expect(
			sqlite
				.prepare(
					"SELECT id, collection_slug, singleton_slug, parent_item, subcollection_key FROM editor_draft ORDER BY id",
				)
				.all(),
		).toEqual([
			{
				collection_slug: null,
				id: "about-draft",
				parent_item: null,
				singleton_slug: "about",
				subcollection_key: null,
			},
			{
				collection_slug: "posts",
				id: "posts-draft",
				parent_item: null,
				singleton_slug: null,
				subcollection_key: null,
			},
		])
	} finally {
		sqlite.close()
		rmSync(before, { force: true, recursive: true })
	}
})
