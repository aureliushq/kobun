import { eq } from "drizzle-orm"
import { afterEach, beforeEach, expect, test } from "vitest"
import { userPreference } from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb, type InMemoryDb } from "@/db/testing"

let close: InMemoryDb["close"]
let db: InMemoryDb["db"]

beforeEach(() => {
	const inMemory = createInMemoryDb()
	close = inMemory.close
	db = inMemory.db
	db.insert(user)
		.values({ email: "writer@example.com", id: "user-1", name: "Writer" })
		.run()
})

afterEach(() => {
	close()
})

function seedPreferences() {
	db.insert(userPreference).values({ userId: "user-1" }).run()
}

function readRow() {
	return db
		.select()
		.from(userPreference)
		.where(eq(userPreference.userId, "user-1"))
		.get()
}

test("a writer who has changed nothing gets today's behaviour", () => {
	seedPreferences()

	expect(readRow()).toMatchObject({
		dateDisplay: "relative",
		editorFont: "sans",
		// Must stay equal to DEFAULT_PRIMARY_EDITOR_ACTION in
		// `app/core/editor/primary-action.ts`. Asserted as a literal rather than
		// imported: `packages/db` does not depend on `app`, and #143 — which owns
		// that module and is the first to need the two to agree — can check them
		// against each other from the side where the import runs the right way.
		editorPrimaryAction: "save",
		editorWidth: "normal",
		locale: null,
		propertiesPanelOpen: true,
		sidebarOpen: true,
		timezone: null,
		wordCountVisible: true,
	})
})

test("a writer has one row of Preferences and cannot have two", () => {
	seedPreferences()

	expect(seedPreferences).toThrow(/UNIQUE constraint failed/)
})

test("a deleted user takes their Preferences with them", () => {
	seedPreferences()

	db.delete(user).where(eq(user.id, "user-1")).run()

	expect(readRow()).toBeUndefined()
})
