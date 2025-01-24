import {
	BookOpenIcon,
	ExternalLinkIcon,
	HouseIcon,
	PanelsTopLeftIcon,
	PlusIcon,
	SettingsIcon,
} from 'lucide-react'
import { useContext } from 'react'
import { Link, useLocation } from 'react-router'
import invariant from 'tiny-invariant'

import Logo from '@/components/layouts/blocks/logo'
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PATHS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { RescribeContext, type RescribeContextData } from '@/providers'

const DashboardSidebar = () => {
	const { config } = useContext<RescribeContextData>(RescribeContext)
	invariant(config, '`config` is required.')

	const location = useLocation()

	return (
		<Sidebar>
			<SidebarHeader>
				<Link
					className='w-full h-12 flex items-center justify-start'
					to={PATHS.BASE}
				>
					<Logo />
				</Link>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={location.pathname === PATHS.BASE}
								>
									<Link to={PATHS.BASE}>
										<HouseIcon />
										<span>Dashboard</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<a
										className='group/view'
										href='http://localhost:5173/docs'
										rel='noreferrer'
										target='_blank'
									>
										<PanelsTopLeftIcon />
										<span className='flex-grow'>
											View Site
										</span>
										<ExternalLinkIcon className='hidden transition-all duration-100 group-hover/view:inline' />
									</a>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Collections</SidebarGroupLabel>
					{Object.keys(config.collections).map((key, index) => {
						const collection = config.collections[key]
						const link = `${PATHS.COLLECTIONS}/${collection.slug}`
						const addTitle = `Add ${collection.label}`

						return (
							<section
								className={cn(
									Object.keys(config.collections).length -
										1 !==
										index && 'mb-4',
								)}
								key={collection.slug}
							>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={
												location.pathname === link &&
												location.search === ''
											}
										>
											<Link to={link}>
												{`${collection.label}`}
											</Link>
										</SidebarMenuButton>
										<SidebarMenuAction
											asChild
											title={addTitle}
										>
											<Link to={`${link}/new`}>
												<PlusIcon />{' '}
												<span className='sr-only'>
													{addTitle}
												</span>
											</Link>
										</SidebarMenuAction>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={
												location.pathname === link &&
												location.search ===
													'?status=published'
											}
										>
											<Link
												to={`${link}?status=published`}
											>
												Published
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={
												location.pathname === link &&
												location.search ===
													'?status=draft'
											}
										>
											<Link to={`${link}?status=draft`}>
												Drafts
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</section>
						)
					})}
				</SidebarGroup>
				<SidebarGroup>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild>
								<a
									className='group/docs'
									href='https://rescribe.site/docs'
									rel='noreferrer'
									target='_blank'
								>
									<BookOpenIcon />
									<span className='flex-grow'>
										Documentation
									</span>
									<ExternalLinkIcon className='hidden transition-all duration-100 group-hover/docs:inline' />
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								asChild
								isActive={location.pathname === PATHS.SETTINGS}
							>
								<Link to={PATHS.SETTINGS}>
									<SettingsIcon />
									<span>Settings</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	)
}

export default DashboardSidebar
