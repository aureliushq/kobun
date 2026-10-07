import { Suspense } from "react"
import { Await, NavLink } from "react-router"
import { createCollectionListingCache } from "@/core/editor/collection-listing-cache.server"
import {
	type CollectionItem,
	CollectionTable,
} from "@/core/editor/collection-table"
import {
	type CollectionDraft,
	getSubcollectionPath,
} from "@/core/editor/drafts"
import { createGithubCollectionListingSource } from "@/core/editor/github-collection-listing-source.server"
import { resolveTitleKey } from "@/core/fields"
import { requireSubcollection } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { H1 } from "@/ui/components/base/typegraphy"
import { cn } from "@/ui/lib/utils"
import type { Route } from "./+types/subcollection"

const stem = (name: string) => name.replace(/\.mdx?$/, "")

/**
 * The Parent Item a URL names, by its filename stem (ADR-0012). The listing
 * holds Sources only, so a Parent Item that exists only as a Draft — or no
 * longer exists — is a not-found: its Subcollections exist once it has a
 * Source.
 */
export function requireParentItem(
	items: CollectionItem[],
	parentStem: string,
): CollectionItem {
	const parent = items.find((item) => stem(item.name) === parentStem)
	if (!parent) throw new Response("Parent Item not found", { status: 404 })
	return parent
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const ctx = await requirePageContext({ context, params, request })
	const { db, env, installationId, name, owner, projectRow } = ctx
	const { collection_slug, parent_item, subcollection_key } = params
	const { directoryPath, parent, subcollection } = requireSubcollection(
		ctx,
		collection_slug,
		subcollection_key,
		parent_item,
	)

	const listings = createCollectionListingCache({
		db,
		listingSource: createGithubCollectionListingSource(env),
	})
	const repository = { installationId, name, owner }
	const project = { repoName: name, repoOwnerLogin: owner }

	// Awaited, unlike the items below: whether the Parent Item has a Source
	// decides whether this page exists at all (ADR-0006). It is the parent
	// Collection's own cached listing, so it is usually a read of D1 alone
	// (ADR-0011). It also runs before the Subcollection's directory is named to
	// GitHub, so a stem that is no file's never becomes a path.
	const parentItem = requireParentItem(
		await listings.resolve(projectRow, repository, parent.directoryPath),
		parent_item,
	)
	const titleKey = resolveTitleKey(parent.collection.schema)

	return {
		// None yet: a Draft has no Subcollection to be owned by until #182.
		drafts: [] as CollectionDraft[],
		items: listings.resolve(projectRow, repository, directoryPath),
		parentTitle: String((titleKey && parentItem.data[titleKey]) || parent_item),
		project,
		subcollection,
		// The table builds its editor links off this, so they point at where
		// #182 puts the Subcollection editor.
		tableSlug: `${collection_slug}/items/${encodeURIComponent(parent_item)}/${subcollection_key}`,
		tabs: Object.entries(parent.collection.subcollections ?? {}).map(
			([key, { label }]) => ({
				href: getSubcollectionPath(project, collection_slug, parent_item, key),
				label,
			}),
		),
	}
}

export default function Subcollection({ loaderData }: Route.ComponentProps) {
	const {
		drafts,
		items,
		parentTitle,
		project,
		subcollection,
		tableSlug,
		tabs,
	} = loaderData

	const table = (listing: CollectionItem[] | "pending" | "unavailable") => (
		<CollectionTable
			collection={subcollection}
			collectionSlug={tableSlug}
			drafts={drafts}
			project={project}
			listing={listing}
		/>
	)

	return (
		<div className="flex flex-col gap-6">
			<H1>{parentTitle}</H1>
			<nav className="flex gap-1 border-b">
				{tabs.map((tab) => (
					<NavLink
						key={tab.href}
						to={tab.href}
						className={({ isActive }) =>
							cn(
								"-mb-px border-b-2 px-3 py-2 font-medium text-xs",
								isActive
									? "border-primary text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)
						}
					>
						{tab.label}
					</NavLink>
				))}
			</nav>
			{/* Keyed for the reason the Collection page's is: a new tab or Parent
			    Item falls back at once rather than holding the one just left. */}
			<Suspense key={tableSlug} fallback={table("pending")}>
				<Await errorElement={table("unavailable")} resolve={items}>
					{(resolved: CollectionItem[]) => table(resolved)}
				</Await>
			</Suspense>
		</div>
	)
}
