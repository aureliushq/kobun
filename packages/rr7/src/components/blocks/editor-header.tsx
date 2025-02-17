import { PanelRightIcon } from 'lucide-react'
import { useContext } from 'react'
import { Link } from 'react-router'
import invariant from 'tiny-invariant'

import type { Labels } from '@/components/rescribe'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet'
import { RescribeContext, type RescribeContextData } from '@/providers'

const EditorHeader = ({ labels }: { labels: Labels | undefined }) => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	invariant(config, '`config` is required.')

	const basePath = config.basePath ?? ''

	return (
		<header className='rs-sticky rs-w-full rs-h-16 rs-px-4 rs-flex rs-items-center rs-justify-between rs-z-20'>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to={basePath}>Home</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					{(params?.action === 'create' ||
						params?.action === 'edit') && (
						<>
							<BreadcrumbSeparator />
							<BreadcrumbItem>Collections</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>
									{
										config?.collections[params?.collection]
											.label
									}
								</BreadcrumbPage>
							</BreadcrumbItem>
						</>
					)}
				</BreadcrumbList>
			</Breadcrumb>
			<section className='rs-flex rs-items-center rs-gap-2'>
				{params?.action === 'edit' && (
					<Button size='sm' variant='ghost'>
						Publish
					</Button>
				)}
				<Sheet>
					<SheetTrigger asChild>
						<Button size='icon' variant='ghost'>
							<PanelRightIcon />
						</Button>
					</SheetTrigger>
					<SheetContent
						className='[&>button]:rs-hidden rs-p-0'
						side='right'
					>
						<SheetHeader className='rs-h-16 rs-px-4 rs-flex rs-flex-row rs-items-center rs-justify-between rs-space-y-0'>
							<SheetTitle>{`${labels?.singular} Settings`}</SheetTitle>
							<SheetClose asChild>
								<Button size='icon' variant='ghost'>
									<PanelRightIcon />
								</Button>
							</SheetClose>
						</SheetHeader>
					</SheetContent>
				</Sheet>
			</section>
		</header>
	)
}

export default EditorHeader
