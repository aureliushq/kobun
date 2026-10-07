/** Where an entity and its editor live, for one project. */
export interface ProjectLocation {
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

/**
 * One Parent Item's page of one Subcollection, addressed by the Parent Item's
 * filename stem (ADR-0012). `items/` keeps a Parent Item called `editor` from
 * answering to the Collection's own editor route.
 */
export function getSubcollectionPath(
	project: ProjectLocation,
	collectionSlug: string,
	parentStem: string,
	subcollectionKey: string,
) {
	return `${getCollectionPath(project, collectionSlug)}/items/${encodeURIComponent(parentStem)}/${subcollectionKey}`
}

/** The Singleton's own page: the one document it holds. */
export function getSingletonPath(
	project: ProjectLocation,
	singletonSlug: string,
) {
	return `/${project.repoOwnerLogin}/${project.repoName}/singletons/${singletonSlug}`
}

/**
 * Where a Singleton is edited, and where its array rows open their own editors
 * beneath. A Collection's equivalent stays private to this module, but this one
 * is exported: a Singleton's own page links straight to its editor.
 */
export function getSingletonEditorPath(
	project: ProjectLocation,
	singletonSlug: string,
) {
	return `${getSingletonPath(project, singletonSlug)}/editor`
}

function collectionEditorPath(
	project: ProjectLocation,
	collectionSlug: string,
) {
	return `${getCollectionPath(project, collectionSlug)}/editor`
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
 * The editor for an item that has never been committed. Once it has a Draft it
 * carries that Draft in the query string, since nothing in the repository names
 * it yet; before its first save it has none to carry.
 */
export function getNewItemEditorPath(
	project: ProjectLocation,
	collectionSlug: string,
	draftId?: string,
) {
	const path = `${collectionEditorPath(project, collectionSlug)}/new`
	return draftId ? `${path}?draft=${encodeURIComponent(draftId)}` : path
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
