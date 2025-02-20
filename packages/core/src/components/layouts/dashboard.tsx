import type { ReactNode } from 'react'

import DashboardHeader from '~/components/blocks/dashboard-header'
import DashboardSidebar from '~/components/blocks/sidebar'
import { ScrollArea } from '~/components/ui/scroll-area'
import { SidebarProvider } from '~/components/ui/sidebar'

const DashboardLayout = ({
	children,
}: { children?: ReactNode | ReactNode[] }) => {
	return (
		<SidebarProvider className='rs-dark'>
			<DashboardSidebar />
			<main className='rs-w-screen rs-h-screen rs-flex rs-flex-col rs-gap-4'>
				<DashboardHeader />
				<ScrollArea className='rs-w-full rs-h-full rs-p-8 rs-z-10'>
					<section className='rs-w-full rs-flex rs-justify-center'>
						<div className='rs-w-full rs-max-w-5xl rs-flex rs-flex-col rs-gap-4'>
							{children}
						</div>
					</section>
				</ScrollArea>
			</main>
		</SidebarProvider>
	)
}

export default DashboardLayout
