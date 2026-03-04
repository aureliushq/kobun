import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type AppDatabase = DrizzleD1Database<typeof schema>;

export function getDB(d1: D1Database): AppDatabase {
	return drizzle(d1, { schema, casing: "snake_case" });
}
