import { PATHS } from '@runica/common'
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
} from '~/components/ui/breadcrumb'
import { Button } from '~/components/ui/button'
import { RescribeContext, type RescribeContextData } from '~/providers'

const EditorHeader = ({
	collectionSlug,
	defaultValue,
	isContentFieldAvailable,
	openCollectionSettings,
	setOpenCollectionSettings,
}: {
	collectionSlug: string
	defaultValue?: { [x: string]: unknown }
	isContentFieldAvailable: boolean
	openCollectionSettings: boolean
	setOpenCollectionSettings: Dispatch<SetStateAction<boolean>>
}) => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	invariant(config, '`config` is required.')
	invariant(
		config?.collections[collectionSlug],
		'Collection not found in config',
	)

	const basePath = config.basePath ?? ''
	const collection = config.collections[collectionSlug]

	return (
		<header className='rs-sticky rs-w-full rs-h-16 rs-px-4 rs-flex rs-items-center rs-justify-between rs-z-20'>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to={basePath}>Home</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>Collections</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link
								to={`${basePath}/${PATHS.COLLECTIONS}/${collectionSlug}`}
							>
								{config?.collections[collectionSlug].label}
							</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					{params?.section === 'editor-edit' &&
						defaultValue?.title !== '' &&
						defaultValue?.title !== undefined && (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>
										{defaultValue?.title as string}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						)}
				</BreadcrumbList>
			</Breadcrumb>
			<section className='rs-flex rs-items-center rs-gap-2'>
				{params?.section === 'editor-create' && (
					<Button
						name='intent'
						size='sm'
						type='submit'
						value='create'
						variant='ghost'
					>
						Create
					</Button>
				)}
				{params?.section === 'editor-edit' && (
					<Button
						name='intent'
						size='sm'
						type='submit'
						value='edit'
						variant='ghost'
					>
						Save
					</Button>
				)}
				{collection?.features?.publish && (
					<Button
						className='rs-text-green-500'
						name='intent'
						size='sm'
						type='submit'
						value='publish'
						variant='ghost'
					>
						Publish
					</Button>
				)}
				{isContentFieldAvailable && !openCollectionSettings && (
					<Button
						onClick={() => setOpenCollectionSettings(true)}
						size='icon'
						variant='ghost'
					>
						<PanelRightIcon />
					</Button>
				)}
			</section>
		</header>
	)
}

export default EditorHeader
