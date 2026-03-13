import {
	BookOpenIcon,
	CheckIcon,
	ChevronsUpDownIcon,
	ExternalLinkIcon,
	HouseIcon,
	LogOutIcon,
	SettingsIcon,
} from "lucide-react"
// import { useContext } from "react";
import { Form, Link, useLocation } from "react-router"

// import invariant from "tiny-invariant";

import type { Project } from "@/db/types"
// import {
// 	Avatar,
// 	AvatarFallback,
// 	AvatarImage,
// } from "@/ui/components/base/avatar"
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
	useSidebar,
} from "@/ui/components/base/sidebar"
import { Logo, LogoDark } from "@/ui/components/logo"
import { useTheme } from "@/ui/hooks/use-theme"
import { PATHS } from "@/ui/lib/constants"
import { DashboardActionIntents } from "@/ui/lib/types"

// import { cn } from "~/lib/utils";

// import { KobunContext, type KobunContextData, useTheme } from "~/providers";

const DashboardSidebar = ({
	activeProject,
	projects,
}: {
	activeProject: Project
	projects: Project[]
}) => {
	const { isMobile } = useSidebar()
	// const { config } = useContext<KobunContextData>(KobunContext);
	// invariant(config, "`config` is required.");
	// const basePath = config.basePath ?? "";
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
						{repoSlug}
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
											{/*<Avatar className="size-4">
                        <AvatarImage
                          src={account.avatarUrl}
                          alt={`${account.login}'s avatar`}
                        />
                        <AvatarFallback>
                          {account.login.charAt(0)}
                        </AvatarFallback>
                      </Avatar>*/}
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
			<SidebarContent>
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
					{/*{Object.keys(config.collections).map((key, index) => {
            const collection = config.collections[key];
            const link = `${basePath}/${PATHS.COLLECTIONS}/${key}`;
            const addTitle = `Add ${collection.label}`;

            return (
              <section
                className={cn(
                  Object.keys(config.collections).length - 1 !== index &&
                    "mb-4",
                )}
                key={key}
              >
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location.pathname === link && location.search === ""
                      }
                    >
                      <Link to={link}>{`${collection.label}`}</Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction asChild title={addTitle}>
                      <Link to={`${basePath}/${PATHS.EDITOR}/${key}`}>
                        <PlusIcon />{" "}
                        <span className="sr-only">{addTitle}</span>
                      </Link>
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                  {collection.features?.publish && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={
                            location.pathname === link &&
                            location.search === "?status=published"
                          }
                        >
                          <Link to={`${link}?status=published`}>Published</Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={
                            location.pathname === link &&
                            location.search === "?status=draft"
                          }
                        >
                          <Link to={`${link}?status=draft`}>Drafts</Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                </SidebarMenu>
              </section>
            );
          })}*/}
				</SidebarGroup>
				{/*{config.singletons && (
          <SidebarGroup>
            <SidebarGroupLabel>Singletons</SidebarGroupLabel>
            <SidebarMenu>
              {Object.keys(config.singletons).map((key) => {
                const singleton = config.singletons?.[key];
                const link = `${basePath}/${PATHS.SINGLETONS}/${key}`;
                return (
                  <SidebarMenuItem key={key}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location.pathname === link && location.search === ""
                      }
                    >
                      <Link to={link}>{`${singleton?.label}`}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}*/}
			</SidebarContent>
			<SidebarFooter>
				<SidebarGroup>
					<SidebarMenu>
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
							<SidebarMenuButton
								isActive={location.pathname === `${basePath}/${PATHS.SETTINGS}`}
								render={
									<Link
										className="sidebar-menu-button"
										to={`${basePath}/${PATHS.SETTINGS}`}
									/>
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
