import { useParams, useRouteLoaderData } from "react-router"
import invariant from "tiny-invariant"
import type { loader as dashboardLayoutLoader } from "@/core/components/layouts/dashboard"
import { H2 } from "@/ui/components/base/typegraphy"

export default function Singleton() {
	const layoutData = useRouteLoaderData<typeof dashboardLayoutLoader>(
		"core/components/layouts/dashboard",
	)
	const config = layoutData?.configResult?.config
	const params = useParams()
	invariant(params.singleton_slug, "singleton_slug is required")

	const singleton = config?.singletons[params.singleton_slug]
	invariant(singleton, "singleton is required")

	return <H2>{singleton.label}</H2>
}
