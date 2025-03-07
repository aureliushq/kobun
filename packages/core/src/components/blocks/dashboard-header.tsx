import { GithubIcon, Moon, Sun } from 'lucide-react'
import { useContext } from 'react'
import { Link } from 'react-router'
import invariant from 'tiny-invariant'

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'
import { Button } from '~/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { SIDEBAR_WIDTH } from '~/components/ui/sidebar'
import { KobunContext, type KobunContextData, useTheme } from '~/providers'

const DashboardHeader = () => {
	const { config, params } = useContext<KobunContextData>(KobunContext)
	invariant(config, '`config` is required.')
	const basePath = config.basePath ?? ''

	const { setTheme } = useTheme()

	return (
		<header
			className={`rs-sticky rs-w-[calc(100vw-${SIDEBAR_WIDTH})] rs-h-16 rs-px-4 rs-flex rs-items-center rs-justify-between rs-z-20`}
		>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						{params?.section === 'root' ? (
							<BreadcrumbPage>
								<BreadcrumbLink asChild>
									<Link to={basePath}>Home</Link>
								</BreadcrumbLink>
							</BreadcrumbPage>
						) : (
							<BreadcrumbLink asChild>
								<Link to={basePath}>Home</Link>
							</BreadcrumbLink>
						)}
					</BreadcrumbItem>
					{params?.section === 'collections' && (
						<>
							<BreadcrumbSeparator />
							<BreadcrumbItem>Collections</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>
									{
										config?.collections[
											params?.collectionSlug
										].label
									}
								</BreadcrumbPage>
							</BreadcrumbItem>
						</>
					)}
					{params?.section === 'settings' && (
						<>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>Settings</BreadcrumbPage>
							</BreadcrumbItem>
						</>
					)}
				</BreadcrumbList>
			</Breadcrumb>
			<section className='rs-flex rs-items-center rs-gap-2'>
				<a
					href='https://github.com/aureliushq/kobun'
					rel='noreferrer'
					target='_blank'
				>
					<Button size='icon' variant='ghost'>
						<GithubIcon />
					</Button>
				</a>
				{/* TODO: make this functional */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='ghost' size='icon'>
							<Sun className='rs-h-[1.2rem] rs-w-[1.2rem] rs-rotate-0 rs-scale-100 rs-transition-all dark:-rs-rotate-90 dark:rs-scale-0' />
							<Moon className='rs-absolute rs-h-[1.2rem] rs-w-[1.2rem] rs-rotate-90 rs-scale-0 rs-transition-all dark:rs-rotate-0 dark:rs-scale-100' />
							<span className='rs-sr-only'>Toggle theme</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						<DropdownMenuItem onClick={() => setTheme('light')}>
							Light
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme('dark')}>
							Dark
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme('system')}>
							System
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</section>
		</header>
	)
}

export default DashboardHeader
