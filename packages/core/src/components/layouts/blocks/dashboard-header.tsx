import { useContext } from 'react'
import { Link } from 'react-router'
import { GithubIcon, SunIcon } from 'lucide-react'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { PATHS } from '@/lib/constants'
import { RescribeContext, type RescribeContextData } from '@/providers'

const DashboardHeader = () => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)

	console.log(params)

	return (
		<header className='w-full h-16 px-4 flex items-center justify-between border-b border-border'>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						{params?.root ? (
							<BreadcrumbPage>
								<BreadcrumbLink asChild>
									<Link to={PATHS.BASE}>Home</Link>
								</BreadcrumbLink>
							</BreadcrumbPage>
						) : (
							<BreadcrumbLink asChild>
								<Link to={PATHS.BASE}>Home</Link>
							</BreadcrumbLink>
						)}
					</BreadcrumbItem>
					{params?.section === 'collections' &&
						params.action === 'list' && (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem>Collections</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>
										{
											config?.collections[
												params?.collection
											].label
										}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						)}
				</BreadcrumbList>
			</Breadcrumb>
			<section className='flex items-center gap-2'>
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
