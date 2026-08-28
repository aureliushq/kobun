/** Where a collection and its editor live, for one project. */
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

/** The Collection's own page: the list of items it holds. */
export function getCollectionPath(
	project: ProjectLocation,
	collectionSlug: string,
) {
	return `/${project.repoOwnerLogin}/${project.repoName}/collections/${collectionSlug}`
}

function collectionEditorPath(
	project: ProjectLocation,
	collectionSlug: string,
) {
	return `${getCollectionPath(project, collectionSlug)}/editor`
}

/** The editor for an item the repository already holds. */
function getCollectionItemEditorPath(
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

/**
 * Whether a navigation is nothing but the editor adopting the identifier its
 * first save minted. Such a navigation changes the URL and nothing else — the
 * editor already holds the content the loader would answer with — so the route
 * declines to revalidate rather than replace a sentence the writer is still
 * typing with the round trip's version of it.
 *
 * It lives here because `?draft=` is this module's convention — the same one
 * `getNewItemEditorPath` writes — and nowhere else should have to know it.
 */
export function isDraftAdoptionNavigation(currentUrl: URL, nextUrl: URL) {
	return (
		currentUrl.pathname === nextUrl.pathname &&
		currentUrl.searchParams.get("draft") === null &&
		nextUrl.searchParams.get("draft") !== null
	)
}
