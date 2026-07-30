import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "./schema"

const MIGRATIONS_FOLDER = join(
	dirname(fileURLToPath(import.meta.url)),
	"migrations",
)

export interface InMemoryDb {
	close(): void
	db: BetterSQLite3Database<typeof schema>
}

/**
 * A real SQLite database in memory, with the checked-in migrations applied — the
 * same DDL CI and production run against D1. Use it wherever the SQL itself is
 * the subject under test (optimistic-concurrency `WHERE` guards, unique
 * indexes, cascades); faking the database would fake the subject.
 */
export function createInMemoryDb(): InMemoryDb {
	const sqlite = new Database(":memory:")
	const db = drizzle(sqlite, { casing: "snake_case", schema })
	migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
	// D1 enforces foreign keys; better-sqlite3 does not unless asked.
	sqlite.pragma("foreign_keys = ON")
	return {
		close: () => sqlite.close(),
		db,
	}
}
