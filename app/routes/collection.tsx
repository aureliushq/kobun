import { Suspense } from "react"
import { Await, useParams } from "react-router"
import { createCollectionListingCache } from "@/core/editor/collection-listing-cache.server"
import {
	type CollectionItem,
	CollectionTable,
} from "@/core/editor/collection-table"
import { listCollectionDrafts } from "@/core/editor/drafts"
import { createGithubCollectionListingSource } from "@/core/editor/github-collection-listing-source.server"
import { requireCollection } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import type { Route } from "./+types/collection"

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const { collection_slug } = params
	const ctx = await requirePageContext({ context, params, request })
	const { db, env, installationId, name, owner, projectRow } = ctx
	// Awaited: this 404s on a Collection the Config no longer declares, and the
	// label and schema it returns are what say which page this is.
	const { collection, directoryPath } = requireCollection(ctx, collection_slug)

	const listings = createCollectionListingCache({
		db,
		listingSource: createGithubCollectionListingSource(env),
	})

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
		// Started below the guards — a promise above one is a request nobody
		// reads. Deferred for the reason it always was: none of it decides
		// whether this page may be seen (ADR 0006), and anything that throws in
		// there — a Content Document kobun cannot parse, a GitHub the cache has
		// nothing to fall back on for — rejects this promise rather than the
		// loader, so it reaches the section's error state instead of taking down
		// the frame the split exists to render. What changed is how rarely it
		// costs a directory read at all (ADR 0011).
		items: listings.resolve(
			projectRow,
			{ installationId, name, owner },
			directoryPath,
		),
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
