import { GithubIcon, SunIcon } from 'lucide-react'
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
import { SIDEBAR_WIDTH } from '~/components/ui/sidebar'
import { Toggle } from '~/components/ui/toggle'
import { RescribeContext, type RescribeContextData } from '~/providers'

const DashboardHeader = () => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	invariant(config, '`config` is required.')

	const basePath = config.basePath ?? ''

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
					href='https://github.com/aureliushq/rescribe'
					rel='noreferrer'
					target='_blank'
				>
					<Button size='icon' variant='ghost'>
						<GithubIcon />
					</Button>
				</a>
				{/* TODO: make this functional */}
				<Toggle>
					<SunIcon />
				</Toggle>
			</section>
		</header>
	)
}

export default DashboardHeader
