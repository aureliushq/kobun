import { Moon, RefreshCcwIcon, Sun } from "lucide-react"
import { Form, Link, useParams } from "react-router"

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/ui/components/base/breadcrumb"
import { Button } from "@/ui/components/base/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/ui/components/base/dropdown-menu"
import { SIDEBAR_WIDTH } from "@/ui/components/base/sidebar"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/ui/components/base/tooltip"
import { useTheme } from "@/ui/hooks/use-theme"
import { DashboardActionIntents } from "@/ui/lib/types"

const DashboardHeader = () => {
	const basePath = ""
	const { theme, setTheme } = useTheme()
	const params = useParams()

	return (
		<header
			className={`sticky w-[calc(100vw-${SIDEBAR_WIDTH})] z-20 flex shrink-0 h-16 items-center justify-between px-4`}
		>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to={basePath} />}>
							Home
						</BreadcrumbLink>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<section className="flex items-center gap-2">
				<Tooltip>
					<TooltipTrigger
						render={
							<Form
								action="/api/dashboard-actions"
								method="POST"
								navigate={false}
							>
								<input type="hidden" name="owner" value={params.owner} />
								<input type="hidden" name="name" value={params.name} />
								<Button
									name="intent"
									size="icon"
									type="submit"
									value={DashboardActionIntents.REFRESH_CONFIGURATION}
									variant="ghost"
								>
									<RefreshCcwIcon />
								</Button>
							</Form>
						}
					/>
					<TooltipContent>
						<p>Refresh Configuration</p>
					</TooltipContent>
				</Tooltip>
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
						<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
						<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
						<span className="sr-only">Toggle theme</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuRadioGroup
							value={theme}
							onValueChange={(value) =>
								setTheme(value as "light" | "dark" | "system")
							}
						>
							<DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="system">
								System
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</section>
		</header>
	)
}

export default DashboardHeader
