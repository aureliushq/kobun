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

import { LogoDark } from '@/components/blocks/logo'
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
	const basePath = config.basePath ?? ''

	return (
		<Sidebar>
			<SidebarHeader>
				<Link
					className='rs-w-full rs-h-12 rs-flex rs-items-center rs-justify-start'
					to={basePath}
				>
					<LogoDark />
				</Link>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									asChild
									isActive={
										location.pathname === basePath ||
										location.pathname === PATHS.BASE
									}
								>
									<Link to={basePath}>
										<HouseIcon />
										<span>Dashboard</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<a
										className='rs-group/view'
										href='http://localhost:5173/docs'
										rel='noreferrer'
										target='_blank'
									>
										<PanelsTopLeftIcon />
										<span className='rs-flex-grow'>
											View Site
										</span>
										<ExternalLinkIcon className='rs-hidden rs-transition-all rs-duration-100 group-hover/view:rs-inline' />
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
						const link = `${basePath}/${PATHS.COLLECTIONS}/${collection.slug}`
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
											<Link
												to={`${basePath}/${PATHS.EDITOR}/${collection.slug}`}
											>
												<PlusIcon />{' '}
												<span className='rs-sr-only'>
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
									className='rs-group/docs'
									href='https://rescribe.site/docs'
									rel='noreferrer'
									target='_blank'
								>
									<BookOpenIcon />
									<span className='rs-flex-grow'>
										Documentation
									</span>
									<ExternalLinkIcon className='rs-hidden rs-transition-all rs-duration-100 group-hover/docs:rs-inline' />
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
						<SidebarMenuItem>
							<SidebarMenuButton
								asChild
								isActive={
									location.pathname ===
									`${basePath}/${PATHS.SETTINGS}`
								}
							>
								<Link to={`${basePath}/${PATHS.SETTINGS}`}>
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
