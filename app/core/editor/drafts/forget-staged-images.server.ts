import { eq } from "drizzle-orm"
import { stagedImageIds } from "@/core/editor/staged-images"
import { editorDraft } from "@/db/schema/app-schema"
import type { Database } from "@/db/types"
import type { StagedImageStore } from "./staged-image-store"

/**
 * Forget the Staged Images among `ids` that no Draft of the Project links to.
 * A Draft that links one would have its next Commit refused for a missing
 * image, so a link anywhere in the Project keeps it.
 */
export async function forgetStagedImages(
	db: Database,
	projectId: string,
	store: Pick<StagedImageStore, "baseUrl" | "delete">,
	ids: string[],
): Promise<void> {
	if (!ids.length) return
	const drafts = await db.query.editorDraft.findMany({
		columns: { id: true, markdown: true },
		where: eq(editorDraft.projectId, projectId),
	})
	const linked = new Set(
		drafts.flatMap((draft) => stagedImageIds(draft.markdown, store.baseUrl)),
	)
	const unlinked = [...new Set(ids)].filter((id) => !linked.has(id))
	if (unlinked.length) await store.delete(unlinked)
}
