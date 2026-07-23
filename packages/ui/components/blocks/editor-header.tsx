import { Link } from "react-router"

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/ui/components/base/breadcrumb"
import { Button } from "@/ui/components/base/button"

const EditorHeader = () => {
	const basePath = ""

	return (
		<header className="sticky z-20 flex h-16 w-full items-center justify-between px-4">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to={basePath} />}>
							Back to Collection
						</BreadcrumbLink>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<section className="flex items-center gap-2">
				<Button>Save</Button>
				<Button>Publish</Button>
			</section>
		</header>
	)
}

export default EditorHeader
