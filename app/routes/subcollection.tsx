import { Suspense } from "react"
import { Await, NavLink } from "react-router"
import { createCollectionListingCache } from "@/core/editor/collection-listing-cache.server"
import {
	type CollectionItem,
	CollectionTable,
} from "@/core/editor/collection-table"
import {
	contentDirectorySlug,
	getSubcollectionPath,
	listCollectionDrafts,
} from "@/core/editor/drafts"
import { createGithubCollectionListingSource } from "@/core/editor/github-collection-listing-source.server"
import {
	parentItemTitle,
	requireParentItem,
	requireSubcollection,
} from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { H1 } from "@/ui/components/base/typegraphy"
import { cn } from "@/ui/lib/utils"
import type { Route } from "./+types/subcollection"

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const ctx = await requirePageContext({ context, params, request })
	const { db, env, installationId, name, owner, projectRow } = ctx
	const { collection_slug, parent_item, subcollection_key } = params
	const directory = requireSubcollection(
		ctx,
		collection_slug,
		subcollection_key,
		parent_item,
	)
	const { parent } = directory

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

	return {
		// Awaited for the reason the Collection page's are: one indexed read of a
		// table this request has already resolved the Project of.
		drafts: await listCollectionDrafts(db, projectRow, directory),
		items: listings.resolve(projectRow, repository, directory.directoryPath),
		parentTitle: parentItemTitle(parent.collection, parentItem),
		project,
		subcollection: directory.collection,
		// The table builds its editor links off this, so they point at the
		// Subcollection's editor under this Parent Item.
		tableSlug: contentDirectorySlug(directory),
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
