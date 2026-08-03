/** Where the editor for a collection lives, for one project. */
interface ProjectLocation {
	repoName: string
	repoOwnerLogin: string
}

/** A Draft, as far as addressing its editor goes. */
interface DraftLocation {
	collectionSlug: string
	id: string
	itemSlug: string | null
	sourcePath: string | null
}

function collectionEditorPath(
	project: ProjectLocation,
	collectionSlug: string,
) {
	return `/${project.repoOwnerLogin}/${project.repoName}/collections/${collectionSlug}/editor`
}

/** The editor for an item the repository already holds. */
export function getCollectionItemEditorPath(
	project: ProjectLocation,
	collectionSlug: string,
	itemSlug: string,
) {
	return `${collectionEditorPath(project, collectionSlug)}/item/${encodeURIComponent(itemSlug)}`
}

/**
 * The editor for an item that has never been published. It carries its Draft in
 * the query string, since nothing in the repository names it yet.
 */
function getNewItemEditorPath(
	project: ProjectLocation,
	collectionSlug: string,
	draftId: string,
) {
	return `${collectionEditorPath(project, collectionSlug)}/new?draft=${encodeURIComponent(draftId)}`
}

/**
 * Where a Draft is edited. A Draft that tracks a Source is reached through the
 * item it belongs to; one that does not is reached through its own id.
 */
export function getDraftEditorPath(
	draft: DraftLocation,
	project: ProjectLocation,
) {
	if (!draft.sourcePath) {
		return getNewItemEditorPath(project, draft.collectionSlug, draft.id)
	}
	return getCollectionItemEditorPath(
		project,
		draft.collectionSlug,
		draft.itemSlug ?? draft.id,
	)
}
