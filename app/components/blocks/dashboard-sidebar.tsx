import {
	BookOpenIcon,
	ExternalLinkIcon,
	HouseIcon,
	LogOutIcon,
	SettingsIcon,
} from "lucide-react";
// import { useContext } from "react";
import { Form, Link, useLocation } from "react-router";
// import invariant from "tiny-invariant";

import { Logo, LogoDark } from "~/components/blocks/logo";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	// SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import { PATHS } from "~/lib/constants";

// import { cn } from "~/lib/utils";

// import { KobunContext, type KobunContextData, useTheme } from "~/providers";

const DashboardSidebar = () => {
	// const { config } = useContext<KobunContextData>(KobunContext);
	// invariant(config, "`config` is required.");
	// const basePath = config.basePath ?? "";
	const basePath = "";

	const location = useLocation();

	// const { theme } = useTheme();
	const theme = "light";

	return (
		<Sidebar>
			<SidebarHeader>
				<Link
					className="w-full h-12 flex items-center justify-start"
					to={basePath}
				>
					{theme === "light" ? <Logo /> : <LogoDark />}
				</Link>
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
								<span className="flex-grow">Documentation</span>
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
							<Form method="POST">
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
	);
};

export default DashboardSidebar;
