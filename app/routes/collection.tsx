import { Suspense } from "react"
import { Await, useParams } from "react-router"
import { parseDocument } from "@/core/content/document.server"
import {
	collectionFileFormat,
	isMarkdownCollectionFile,
	type RepositoryCollectionFile,
} from "@/core/editor/collection-items.server"
import {
	type CollectionItem,
	CollectionTable,
} from "@/core/editor/collection-table"
import { listCollectionDrafts } from "@/core/editor/drafts"
import { requireCollection } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { hasStatus, listGithubDirectoryFiles } from "@/github/octokit.server"
import type { InstallationID } from "@/types/github"
import type { Route } from "./+types/collection"

/**
 * One GraphQL call that pulls the full text of every file in the Collection's
 * directory, then a frontmatter parse per file. None of it decides whether this
 * page may be seen, so the page does not wait on it (ADR 0006).
 *
 * It is `async` for a reason beyond the awaits: anything that throws in here
 * rejects the promise the loader hands to `Await` rather than throwing out of
 * the loader, so it reaches the section's error state instead of taking down
 * the frame the split exists to render. That now includes a Content Document
 * kobun cannot parse, which used to reach the root boundary.
 */
async function loadCollectionItems(
	env: Env,
	installationId: InstallationID,
	owner: string,
	name: string,
	directoryPath: string,
): Promise<CollectionItem[]> {
	// A directory that is not there comes back from the query as no entries at
	// all, so the empty Collection needs nothing from this catch; it is here for
	// the REST-shaped 404 the installation's auth exchange can still raise. Kept
	// narrow either way — a parse failure must never be read as an empty
	// Collection, so the rows are built after it.
	let files: RepositoryCollectionFile[] = []
	try {
		files = await listGithubDirectoryFiles(
			env,
			installationId,
			owner,
			name,
			directoryPath,
		)
	} catch (error) {
		if (!hasStatus(error, 404)) throw error
	}

	// A json/yaml Collection lists nothing here, since the filter only lets md
	// and mdx through — a pre-existing gap, untouched by this route.
	return files.filter(isMarkdownCollectionFile).map((f) => ({
		name: f.name,
		path: f.path,
		sha: f.sha,
		data: parseDocument(f.content, collectionFileFormat(f)).data,
	}))
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const { collection_slug } = params
	const ctx = await requirePageContext({ context, params, request })
	const { db, env, installationId, name, owner, projectRow } = ctx
	// Awaited: this 404s on a Collection the Config no longer declares, and the
	// label and schema it returns are what say which page this is.
	const { collection, directoryPath } = requireCollection(ctx, collection_slug)

	return {
		collection,
		collectionSlug: collection_slug,
		// Awaited, though it gates nothing: one indexed read of a table this
		// request has already resolved the Project of, and awaiting it is what
		// puts the writer's Drafts on the first paint and keeps them there when
		// GitHub does not answer (ADR 0006).
		drafts: await listCollectionDrafts(
			db,
			projectRow,
			collection,
			collection_slug,
		),
		// Started below the guards — a promise above one is a request nobody reads.
		items: loadCollectionItems(env, installationId, owner, name, directoryPath),
	}
}

export default function Collection({ loaderData }: Route.ComponentProps) {
	const { collection, collectionSlug, drafts, items } = loaderData
	const params = useParams()
	const owner = params.owner ?? ""
	const name = params.name ?? ""
	const editorBase = `/${owner}/${name}/collections/${collectionSlug}/editor`

	return (
		// Keyed by the slug, and on the `Suspense` rather than the `Await`.
		// Navigating between two Collections suspends inside a transition over a
		// boundary that has already revealed content, and React answers that by
		// delaying the whole commit — heading, controls and rows all stay on the
		// Collection the writer just left. A new key at the boundary's position
		// mounts a boundary with nothing revealed, which falls back at once.
		<Suspense
			key={collectionSlug}
			fallback={
				<CollectionTable
					collection={collection}
					drafts={drafts}
					editorBase={editorBase}
					listing="pending"
				/>
			}
		>
			<Await
				errorElement={
					<CollectionTable
						collection={collection}
						drafts={drafts}
						editorBase={editorBase}
						listing="unavailable"
					/>
				}
				resolve={items}
			>
				{(resolved: CollectionItem[]) => (
					<CollectionTable
						collection={collection}
						drafts={drafts}
						editorBase={editorBase}
						listing={resolved}
					/>
				)}
			</Await>
		</Suspense>
	)
}
