import {
	Calendar,
	ExternalLinkIcon,
	Home,
	House,
	HouseIcon,
	Inbox,
	PanelsTopLeftIcon,
	PlusIcon,
	Search,
	Settings,
} from 'lucide-react'

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar'
import { PATHS } from '@/lib/constants'
import { RescribeContext, type RescribeContextData } from '@/providers'
import { Fragment, useContext } from 'react'
import { Link, useLocation } from 'react-router'
import invariant from 'tiny-invariant'
import Logo from './logo'

// Menu items.
const items = [
	{
		title: 'Home',
		url: '#',
		icon: Home,
	},
	{
		title: 'Inbox',
		url: '#',
		icon: Inbox,
	},
	{
		title: 'Calendar',
		url: '#',
		icon: Calendar,
	},
	{
		title: 'Search',
		url: '#',
		icon: Search,
	},
	{
		title: 'Settings',
		url: '#',
		icon: Settings,
	},
]

const DashboardSidebar = () => {
	const { config } = useContext<RescribeContextData>(RescribeContext)
	invariant(config, '`config` is required.')

	const location = useLocation()
	console.log(location.pathname)

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
				{/* TODO: each collection should be a collapsible submenu */}
				{Object.keys(config.collections).map((key) => {
					const collection = config.collections[key]
					const link = `${PATHS.COLLECTIONS}/${collection.slug}`
					const addTitle = `Add ${collection.label}`

					return (
						<SidebarGroup key={collection.slug}>
							<SidebarGroupLabel>
								{collection.label}
							</SidebarGroupLabel>
							<SidebarGroupAction asChild title={addTitle}>
								<Link to={`${link}/new`}>
									<PlusIcon />{' '}
									<span className='sr-only'>{addTitle}</span>
								</Link>
							</SidebarGroupAction>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={
												location.pathname === link
											}
										>
											<Link to={link}>
												{`All ${collection.label}`}
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={
												location.pathname === link
											}
										>
											<Link to={link}>Published</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton
											asChild
											isActive={
												location.pathname === link
											}
										>
											<Link to={link}>Drafts</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)
				})}
			</SidebarContent>
		</Sidebar>
	)
}

export default DashboardSidebar
