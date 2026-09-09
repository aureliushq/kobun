import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { afterEach, beforeEach, expect, test } from "vitest"
import type * as schema from "@/db/schema"
import { userPreference } from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb, type InMemoryDb } from "@/db/testing"
import { DEFAULT_USER_PREFERENCES, EditorWidth } from "@/db/types"
import { readUserPreferences, writeUserPreferences } from "@/db/user-preference"

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

function preferences() {
	return db as unknown as DrizzleD1Database<typeof schema>
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
		// imported, because `packages/db` does not depend on `app`; the two are
		// checked against each other in `app/core/editor/stored-primary-action.test.ts`,
		// from the side where the import runs the right way.
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

test("the defaults a writer with no row gets are the ones the columns hold", async () => {
	// The constant and the column defaults are two spellings of one answer, and
	// nothing but this makes them agree. Whichever is changed alone fails here.
	seedPreferences()
	const row = readRow()

	expect(await readUserPreferences(preferences(), "user-1")).toEqual({
		dateDisplay: row?.dateDisplay,
		editorFont: row?.editorFont,
		editorWidth: row?.editorWidth,
		locale: row?.locale,
		propertiesPanelOpen: row?.propertiesPanelOpen,
		sidebarOpen: row?.sidebarOpen,
		timezone: row?.timezone,
		wordCountVisible: row?.wordCountVisible,
	})
	expect(await readUserPreferences(preferences(), "user-1")).toEqual(
		DEFAULT_USER_PREFERENCES,
	)
})

test("a writer who has never changed anything still reads their Preferences", async () => {
	// No row is the ordinary case, not an error: one is written the first time
	// something is changed, and most writers never change anything.
	expect(await readUserPreferences(preferences(), "user-1")).toEqual(
		DEFAULT_USER_PREFERENCES,
	)
})

test("a value SQLite let through outside its vocabulary reads as the default", async () => {
	db.insert(userPreference)
		.values({ editorWidth: "enormous", userId: "user-1" })
		.run()

	expect(await readUserPreferences(preferences(), "user-1")).toMatchObject({
		editorWidth: EditorWidth.NORMAL,
	})
})

test("the first Preference a writer changes writes them a row", async () => {
	await writeUserPreferences(preferences(), "user-1", {
		wordCountVisible: false,
	})

	expect(await readUserPreferences(preferences(), "user-1")).toEqual({
		...DEFAULT_USER_PREFERENCES,
		wordCountVisible: false,
	})
})

test("changing a second Preference leaves the first one alone", async () => {
	await writeUserPreferences(preferences(), "user-1", {
		wordCountVisible: false,
	})
	await writeUserPreferences(preferences(), "user-1", {
		editorWidth: EditorWidth.WIDE,
	})

	expect(await readUserPreferences(preferences(), "user-1")).toEqual({
		...DEFAULT_USER_PREFERENCES,
		editorWidth: EditorWidth.WIDE,
		wordCountVisible: false,
	})
})

test("stating no preference for a locale clears the one on the row", async () => {
	await writeUserPreferences(preferences(), "user-1", { locale: "en-GB" })
	await writeUserPreferences(preferences(), "user-1", { locale: null })

	expect(await readUserPreferences(preferences(), "user-1")).toMatchObject({
		locale: null,
	})
})
