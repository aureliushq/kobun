import DashboardSidebar from '@/components/layouts/blocks/sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { ReactNode } from 'react'

const DashboardLayout = ({
	children,
}: { children?: ReactNode | ReactNode[] }) => {
	return (
		<SidebarProvider>
			<DashboardSidebar />
			<main className='w-screen h-screen p-8 flex flex-col gap-4'>
				{children}
			</main>
		</SidebarProvider>
	)
}

export { DashboardLayout }
