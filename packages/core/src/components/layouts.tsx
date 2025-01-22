import type { ReactNode } from 'react'

const DashboardLayout = ({
	children,
}: { children?: ReactNode | ReactNode[] }) => {
	return (
		<main className='w-screen h-screen p-8 flex flex-col gap-4'>
			{children}
		</main>
	)
}

export { DashboardLayout }
