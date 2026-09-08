import { eq } from "drizzle-orm"
import type { ProjectContextDatabase } from "@/core/project-context/types"
import { project, userInstallation } from "@/db/schema/app-schema"
import { user } from "@/db/schema/auth-schema"

/**
 * Erase a writer and everything Kobun was holding for them.
 *
 * The order is not a preference, it is the schema. `session`, `account` and
 * `userPreference` cascade from `user` and need no help. `project` and
 * `userInstallation` do not — they are `ON DELETE no action` on purpose, so a
 * user's rows outlive them — which means a bare `DELETE FROM user` does not
 * quietly leave them behind, it fails the foreign key. They go first, and
 * deleting a Project takes its Drafts and its cached Collection listings with
 * it by the cascades ADR-0011 relies on.
 *
 * What survives, and must: `githubInstallation`. It has no user column because
 * it is not a fact about a user — it is the App's presence on a GitHub account,
 * shared through `userInstallation` with everyone else who connected the same
 * one. Kobun could not uninstall it on the writer's behalf even if it wanted
 * to, so the page says so and sends them to GitHub to do it themselves. The
 * Sources in their repositories are likewise untouched: this is Disconnect for
 * every Project at once, and Disconnect has never written to a repository.
 *
 * Three statements rather than one transaction, because D1 has no interactive
 * transactions and this module has to keep running on the same driver the
 * in-memory tests cast to. A failure part way leaves a writer with fewer
 * Projects and an account — recoverable, and the alternative is not available.
 */
export async function deleteAccount(
	db: ProjectContextDatabase,
	userId: string,
): Promise<void> {
	await db.delete(project).where(eq(project.userId, userId))
	await db.delete(userInstallation).where(eq(userInstallation.userId, userId))
	await db.delete(user).where(eq(user.id, userId))
}
