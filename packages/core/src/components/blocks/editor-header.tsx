import { PanelRightIcon } from 'lucide-react'
import { type Dispatch, type SetStateAction, useContext } from 'react'
import { Link } from 'react-router'
import invariant from 'tiny-invariant'

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { RescribeContext, type RescribeContextData } from '@/providers'

const EditorHeader = ({
	setOpenCollectionSettings,
}: { setOpenCollectionSettings: Dispatch<SetStateAction<boolean>> }) => {
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
				<Button
					onClick={() => setOpenCollectionSettings(true)}
					size='icon'
					variant='ghost'
				>
					<PanelRightIcon />
				</Button>
			</section>
		</header>
	)
}

export default EditorHeader
