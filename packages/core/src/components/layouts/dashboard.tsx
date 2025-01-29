import type { ReactNode } from 'react'
import DashboardSidebar from '@/components/layouts/blocks/sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import DashboardHeader from '@/components/layouts/blocks/dashboard-header'
import { ScrollArea } from '@/components/ui/scroll-area'

const DashboardLayout = ({
	children,
}: { children?: ReactNode | ReactNode[] }) => {
	return (
		<SidebarProvider className='dark'>
			<DashboardSidebar />
			<main className='w-screen h-screen flex flex-col gap-4'>
				<DashboardHeader />
				<ScrollArea className='w-full h-full p-8'>
					<section className='w-full flex justify-center'>
						<div className='w-full max-w-5xl flex flex-col gap-4'>
							{children}
						</div>
					</section>
				</ScrollArea>
			</main>
		</SidebarProvider>
	)
}

export default DashboardLayout
