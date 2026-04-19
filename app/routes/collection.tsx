import { useParams, useRouteLoaderData } from "react-router"
import invariant from "tiny-invariant"
// import type { Collection } from "@/config"
import type { loader as dashboardLayoutLoader } from "@/core/components/layouts/dashboard"
import { H2 } from "@/ui/components/base/typegraphy"

export default function Collection() {
	const layoutData = useRouteLoaderData<typeof dashboardLayoutLoader>(
		"core/components/layouts/dashboard",
	)
	const config = layoutData?.configResult?.config
	const params = useParams()
	invariant(params.collection_slug, "collection_slug is required")

	const collection = config?.collections[params.collection_slug]
	invariant(collection, "collection is required")

	return <H2>{collection.label}</H2>
}
