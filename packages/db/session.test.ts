import type { DrizzleD1Database } from "drizzle-orm/d1"
import { afterEach, beforeEach, expect, test } from "vitest"
import type * as schema from "@/db/schema"
import { session, user } from "@/db/schema/auth-schema"
import { listActiveSessions } from "@/db/session"
import { createInMemoryDb, type InMemoryDb } from "@/db/testing"

let close: InMemoryDb["close"]
let db: InMemoryDb["db"]

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
	const inMemory = createInMemoryDb()
	close = inMemory.close
	db = inMemory.db
	db.insert(user)
		.values([
			{ email: "writer@example.com", id: "user-1", name: "Writer" },
			{ email: "other@example.com", id: "user-2", name: "Other" },
		])
		.run()
})

afterEach(() => {
	close()
})

function seedSession(id: string, userId: string, expiresIn: number) {
	db.insert(session)
		.values({
			// Older than better-auth's default `freshAge`, which is the case
			// `auth.api.listSessions` refused.
			createdAt: new Date(Date.now() - 2 * DAY),
			expiresAt: new Date(Date.now() + expiresIn),
			id,
			token: `token-${id}`,
			updatedAt: new Date(),
			userId,
		})
		.run()
}

function sessions() {
	return db as unknown as DrizzleD1Database<typeof schema>
}

test("a writer's unexpired sessions are listed, however old", async () => {
	seedSession("session-1", "user-1", DAY)

	const rows = await listActiveSessions(sessions(), "user-1")

	expect(rows.map((row) => row.id)).toEqual(["session-1"])
})

test("an expired session is not listed", async () => {
	seedSession("session-1", "user-1", DAY)
	seedSession("session-2", "user-1", -DAY)

	const rows = await listActiveSessions(sessions(), "user-1")

	expect(rows.map((row) => row.id)).toEqual(["session-1"])
})

test("another writer's sessions are not listed", async () => {
	seedSession("session-1", "user-1", DAY)
	seedSession("session-2", "user-2", DAY)

	const rows = await listActiveSessions(sessions(), "user-1")

	expect(rows.map((row) => row.id)).toEqual(["session-1"])
})
