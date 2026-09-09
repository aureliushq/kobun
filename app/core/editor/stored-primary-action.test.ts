import { afterEach, beforeEach, expect, test } from "vitest"
import type { ProjectContextDatabase } from "@/core/project-context/types"
import { userPreference } from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"
import { createInMemoryDb, type InMemoryDb } from "@/db/testing"
import {
	readEditorPrimaryAction,
	writeEditorPrimaryAction,
} from "@/db/user-preference"
import {
	DEFAULT_PRIMARY_EDITOR_ACTION,
	toPrimaryEditorAction,
} from "./primary-action"

/**
 * The save target, stored (#143).
 *
 * `packages/db/user-preference.test.ts` asserts the column's default as the
 * literal `"save"`, because `packages/db` does not depend on `app` and so cannot
 * name `DEFAULT_PRIMARY_EDITOR_ACTION`. This is the other half of that: the same
 * two facts checked against each other from the side that can import both, so
 * changing one alone fails here.
 */

let close: InMemoryDb["close"]
let sqliteDb: InMemoryDb["db"]

// The schema and its migrations are real; only the driver differs from
// production, so the module keeps its exact D1 type.
function db() {
	return sqliteDb as unknown as ProjectContextDatabase
}

beforeEach(() => {
	const inMemory = createInMemoryDb()
	close = inMemory.close
	sqliteDb = inMemory.db
	sqliteDb
		.insert(user)
		.values({ email: "writer@example.com", id: "user-1", name: "Writer" })
		.run()
})

afterEach(() => {
	close()
})

test("a writer with no row gets the target Kobun would have chosen for them", async () => {
	expect(
		toPrimaryEditorAction(await readEditorPrimaryAction(db(), "user-1")),
	).toBe(DEFAULT_PRIMARY_EDITOR_ACTION)
})

// The column carries its own default, so a row written by anything that does not
// name the save target must still agree with the module that does.
test("a row that never named a target holds the same default the editor does", async () => {
	sqliteDb.insert(userPreference).values({ userId: "user-1" }).run()

	expect(
		toPrimaryEditorAction(await readEditorPrimaryAction(db(), "user-1")),
	).toBe(DEFAULT_PRIMARY_EDITOR_ACTION)
})

// Choosing a target is often the first thing a writer ever changes, so the write
// has to make the row as well as set the column.
test("a first choice creates the row it is stored on", async () => {
	await writeEditorPrimaryAction(db(), "user-1", "commit")

	expect(
		toPrimaryEditorAction(await readEditorPrimaryAction(db(), "user-1")),
	).toBe("commit")
})

test("a later choice replaces the earlier one, and nothing else on the row", async () => {
	await writeEditorPrimaryAction(db(), "user-1", "commit")
	await writeEditorPrimaryAction(db(), "user-1", "save")

	expect(
		toPrimaryEditorAction(await readEditorPrimaryAction(db(), "user-1")),
	).toBe("save")
})

// One writer's chrome is one writer's: the row is keyed by user id, and that is
// the whole point of moving it off a cookie.
test("is one writer's, not the browser's", async () => {
	sqliteDb
		.insert(user)
		.values({ email: "other@example.com", id: "user-2", name: "Other" })
		.run()
	await writeEditorPrimaryAction(db(), "user-1", "commit")

	expect(
		toPrimaryEditorAction(await readEditorPrimaryAction(db(), "user-2")),
	).toBe(DEFAULT_PRIMARY_EDITOR_ACTION)
})
