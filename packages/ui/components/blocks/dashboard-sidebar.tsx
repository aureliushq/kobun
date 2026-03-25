import {
	BookOpenIcon,
	CheckIcon,
	ChevronsUpDownIcon,
	ExternalLinkIcon,
	GithubIcon,
	HouseIcon,
	InfoIcon,
	LogOutIcon,
	SettingsIcon,
} from "lucide-react"
import { Form, Link, useLocation } from "react-router"

import type { ProjectWithGithubInstallation } from "@/db/types"
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/ui/components/base/avatar"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/components/base/dropdown-menu"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
	useSidebar,
} from "@/ui/components/base/sidebar"
import { Logo, LogoDark } from "@/ui/components/logo"
import { useTheme } from "@/ui/hooks/use-theme"
import { PATHS } from "@/ui/lib/constants"
import { DashboardActionIntents } from "@/ui/lib/types"

const DashboardSidebar = ({
	activeProject,
	projects,
}: {
	activeProject: ProjectWithGithubInstallation
	projects: ProjectWithGithubInstallation[]
}) => {
	const { isMobile } = useSidebar()
	const basePath = ""

	const location = useLocation()

	const { resolvedTheme } = useTheme()

	const repoSlug = `${activeProject.repoOwnerLogin}/${activeProject.repoName}`
	const pathname = `/${repoSlug}`

	return (
		<Sidebar>
			<SidebarHeader>
				<div className="flex items-center justify-between px-2">
					<Link
						className="flex h-12 w-full items-center justify-start"
						to={basePath}
					>
						{resolvedTheme === "light" ? <Logo /> : <LogoDark />}
					</Link>
					<Badge className="font-mono text-[0.6rem] uppercase">Alpha</Badge>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button className="h-8 justify-between" variant="outline" />
						}
					>
						<div className="flex items-center gap-2">
							<Avatar className="size-4">
								<AvatarImage
									src={activeProject.githubInstallation.targetAvatarUrl}
									alt={`${activeProject.githubInstallation.targetLogin}'s avatar`}
								/>
								<AvatarFallback>
									{activeProject.githubInstallation.targetLogin.charAt(0)}
								</AvatarFallback>
							</Avatar>
							{repoSlug}
						</div>
						<ChevronsUpDownIcon />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="w-52"
						side={isMobile ? "bottom" : "right"}
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel>Projects</DropdownMenuLabel>
							{projects.map((project, _index) => (
								<DropdownMenuItem key={project.id}>
									<Link
										className="flex w-full items-center justify-between"
										to={`/${project.repoOwnerLogin}/${project.repoName}`}
									>
										<div className="flex items-center gap-2">
											<Avatar className="size-4">
												<AvatarImage
													src={project.githubInstallation.targetAvatarUrl}
													alt={`${project.githubInstallation.targetLogin}'s avatar`}
												/>
												<AvatarFallback>
													{project.githubInstallation.targetLogin.charAt(0)}
												</AvatarFallback>
											</Avatar>
											{`${project.repoOwnerLogin}/${project.repoName}`}
										</div>
										{activeProject.id === project.id && <CheckIcon />}
									</Link>
								</DropdownMenuItem>
							))}
							<DropdownMenuSeparator />
						</DropdownMenuGroup>
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<Link to={PATHS.SETUP}>Create New Project</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarHeader>
			<SidebarContent className="py-2">
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									isActive={location.pathname === `/${repoSlug}`}
									render={
										<Link className="sidebar-menu-button" to={pathname} />
									}
								>
									<HouseIcon />
									Dashboard
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Collections</SidebarGroupLabel>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Singletons</SidebarGroupLabel>
				</SidebarGroup>
				<SidebarGroup className="mt-auto">
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									// biome-ignore lint/a11y/useAnchorContent: it's fine
									<a
										className="group/docs sidebar-menu-button"
										href="https://github.com/aureliushq/kobun"
										rel="noreferrer"
										target="_blank"
									/>
								}
							>
								<GithubIcon />
								<span className="grow">Github</span>
								<ExternalLinkIcon className="hidden transition-all duration-100 group-hover/docs:inline" />
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={
									// biome-ignore lint/a11y/useAnchorContent: it's fine
									<a
										className="group/docs sidebar-menu-button"
										href="https://kobun.dev/docs"
										rel="noreferrer"
										target="_blank"
									/>
								}
							>
								<BookOpenIcon />
								<span className="grow">Documentation</span>
								<ExternalLinkIcon className="hidden transition-all duration-100 group-hover/docs:inline" />
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton className="sidebar-menu-button">
								<InfoIcon />
								<span className="grow">About</span>
								<span className="font-mono text-[0.6rem]">v0.1.0</span>
								<span className="h-2 w-2 rounded-full bg-green-500" />
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			<SidebarSeparator className="ml-0" />
			<SidebarFooter className="px-0">
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								isActive={location.pathname === PATHS.SETTINGS}
								render={
									<Link className="sidebar-menu-button" to={PATHS.SETTINGS} />
								}
							>
								<SettingsIcon />
								<span>Settings</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<Form method="POST" action={PATHS.BASE}>
								<SidebarMenuButton
									className="sidebar-menu-button"
									name="intent"
									type="submit"
									value={DashboardActionIntents.LOGOUT}
								>
									<LogOutIcon />
									<span>Logout</span>
								</SidebarMenuButton>
							</Form>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	)
}

export default DashboardSidebar
