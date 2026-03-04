import { Outlet } from "react-router";

import DashboardHeader from "~/components/blocks/dashboard-header";
import DashboardSidebar from "~/components/blocks/dashboard-sidebar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarProvider } from "~/components/ui/sidebar";

const DashboardLayout = () => {
	return (
		<SidebarProvider>
			<DashboardSidebar />
			<main className="w-screen h-screen bg-muted flex flex-col gap-4">
				<DashboardHeader />
				<ScrollArea className="w-full h-full p-8 z-10">
					<section className="w-full flex justify-center">
						<div className="w-full max-w-6xl flex flex-col gap-4">
							<Outlet />
						</div>
					</section>
				</ScrollArea>
			</main>
		</SidebarProvider>
	);
};

export default DashboardLayout;
