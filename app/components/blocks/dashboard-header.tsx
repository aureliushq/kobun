import { GithubIcon } from "lucide-react";
import { Link } from "react-router";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { SIDEBAR_WIDTH } from "~/components/ui/sidebar";

// import { KobunContext, type KobunContextData, useTheme } from "~/providers";

const DashboardHeader = () => {
	// const { config, params } = useContext<KobunContextData>(KobunContext);
	// invariant(config, "`config` is required.");
	// const basePath = config.basePath ?? "";
	const basePath = "";

	// const { setTheme } = useTheme();

	return (
		<header
			className={`sticky w-[calc(100vw-${SIDEBAR_WIDTH})] h-16 px-4 flex items-center justify-between z-20`}
		>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						{/*{params?.section === "root" ? (*/}
						{/*<BreadcrumbPage>
                <BreadcrumbLink >
                  <Link to={basePath}>Home</Link>
                </BreadcrumbLink>
              </BreadcrumbPage>
            ) : (*/}
						<BreadcrumbLink>
							<Link to={basePath}>Home</Link>
						</BreadcrumbLink>
						{/*)}*/}
					</BreadcrumbItem>
					{/*{params?.section === "collections" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>Collections</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {config?.collections[params?.collectionSlug].label}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
          {params?.section === "settings" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}*/}
				</BreadcrumbList>
			</Breadcrumb>
			<section className="flex items-center gap-2">
				<a
					href="https://github.com/aureliushq/kobun"
					rel="noreferrer"
					target="_blank"
				>
					<Button size="icon" variant="ghost">
						<GithubIcon />
					</Button>
				</a>
				{/* TODO: make this functional */}
				{/*<DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>*/}
			</section>
		</header>
	);
};

export default DashboardHeader;
