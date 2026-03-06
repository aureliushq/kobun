import {
	BookOpenIcon,
	ChevronsUpDownIcon,
	ExternalLinkIcon,
	HouseIcon,
	LogOutIcon,
	SettingsIcon,
} from "lucide-react"
// import { useContext } from "react";
import { Form, Link, useLocation } from "react-router"

// import invariant from "tiny-invariant";

import { useState } from "react"
import { Button } from "@/ui/components/base/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
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
import { Badge } from "../base/badge"

// import { cn } from "~/lib/utils";

// import { KobunContext, type KobunContextData, useTheme } from "~/providers";

const projects = [
	{
		name: "v3.i4o.dev",
		branch: "main",
	},
	{
		name: "bunko.app",
		branch: "main",
	},
	{
		name: "kobun.io",
		branch: "main",
	},
]

const DashboardSidebar = () => {
	const { isMobile } = useSidebar()
	const [activeProject, setActiveProject] = useState(projects[0])
	// const { config } = useContext<KobunContextData>(KobunContext);
	// invariant(config, "`config` is required.");
	// const basePath = config.basePath ?? "";
	const basePath = ""

	const location = useLocation()

	const { resolvedTheme } = useTheme()

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
					<DropdownMenuTrigger render={<Button variant="outline" />}>
						<div className="flex-1 text-left leading-tight">
							<span className="truncate font-medium font-mono">
								{activeProject.name}
							</span>
							{/*<span className="truncate text-xs font-mono">
                {activeProject.branch}
              </span>*/}
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
								<DropdownMenuItem
									className="font-mono"
									onClick={() => setActiveProject(project)}
									key={project.name}
								>
									{project.name}
								</DropdownMenuItem>
							))}
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
									isActive={location.pathname === PATHS.BASE}
									render={
										<Link className="sidebar-menu-button" to={PATHS.BASE} />
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
									value="logout"
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
