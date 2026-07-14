interface DraftRevision {
	publishedAt?: Date | null
	publishedRevision: number | null
	revision: number
}

interface DraftLocation {
	collectionSlug: string
	id: string
	itemSlug: string | null
	sourcePath: string | null
}

interface ProjectLocation {
	repoName: string
	repoOwnerLogin: string
}

export function isDraftDirty(draft: DraftRevision) {
	return (
		draft.publishedRevision === null || draft.revision > draft.publishedRevision
	)
}

export function isPublishedDraftSynced(draft: DraftRevision) {
	return (
		draft.publishedAt != null &&
		draft.publishedRevision !== null &&
		draft.revision === draft.publishedRevision
	)
}

export function getDraftEditorPath(
	draft: DraftLocation,
	project: ProjectLocation,
) {
	const base = `/${project.repoOwnerLogin}/${project.repoName}/collections/${draft.collectionSlug}/editor`
	if (!draft.sourcePath) {
		return `${base}/new?draft=${encodeURIComponent(draft.id)}`
	}
	return `${base}/item/${encodeURIComponent(draft.itemSlug ?? draft.id)}`
}
