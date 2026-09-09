import { Link, useParams } from "react-router"

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/ui/components/base/breadcrumb"
import { SIDEBAR_WIDTH } from "@/ui/components/base/sidebar"

/**
 * The bar above the page: where the writer is, and nothing else.
 *
 * The theme picker used to sit on the right of it. It moved into the sidebar's
 * user menu (#138) rather than being offered twice — the sidebar stands on
 * every page this header does, so nothing lost a way to reach it.
 */
const DashboardHeader = () => {
	const params = useParams()

	return (
		<header
			className={`sticky w-[calc(100vw-${SIDEBAR_WIDTH})] z-20 flex h-16 shrink-0 items-center px-4`}
		>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink
							render={
								<Link
									prefetch="intent"
									to={`/${params.owner}/${params.name}`}
								/>
							}
						>
							Home
						</BreadcrumbLink>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
		</header>
	)
}

export default DashboardHeader
