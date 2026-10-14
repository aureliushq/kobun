import { eq } from "drizzle-orm"
import { removeProjectStagedImages } from "@/core/editor/drafts/r2-staged-image-store.server"
import { project } from "@/db/schema/app-schema"
import type { Database } from "@/db/types"

/**
 * Disconnect a Project: Kobun forgets the repository.
 *
 * One statement, because the schema does the rest. `editorDraft` and
 * `collectionListing` are `ON DELETE cascade` from `project`, so the Drafts it
 * held and the Collection listings it cached go with the row — and the Drafts
 * are the whole reason the page asks twice before calling this. Nothing else in
 * the product destroys writing in bulk. The Staged Images those Drafts linked
 * are in R2, not the schema, so they go by their key prefix once the row has.
 *
 * What stays, and must. `githubInstallation` is the App's presence on a GitHub
 * account, shared with everyone else who connected the same one; Kobun could
 * not uninstall it on the writer's behalf even if it wanted to, and an
 * installation left with one repository is worse than one left alone.
 * `userInstallation` stays with it, so reconnecting the same repository is one
 * step in setup rather than a fresh install. And the Sources — every file
 * already committed — were never Kobun's: Disconnect has never written to a
 * repository (ADR-0010).
 *
 * The caller establishes that the Project is the writer's own; this takes an id
 * it has already been given, the way `deleteAccount` takes a user id.
 */
export async function disconnectProject(
	db: Database,
	bucket: R2Bucket,
	projectId: string,
): Promise<void> {
	await db.delete(project).where(eq(project.id, projectId))
	// The Project is gone either way; an image left behind costs storage only.
	await removeProjectStagedImages(bucket, projectId).catch(() => undefined)
}
