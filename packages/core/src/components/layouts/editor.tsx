import { useForm } from '@conform-to/react'
import type { SchemaKey } from '@kobun/common'
import { useContext, useState } from 'react'
import { Form as RRForm, useActionData, useLoaderData } from 'react-router'
import invariant from 'tiny-invariant'

import EditorHeader from '~/components/blocks/editor-header'
import EditorSidebar from '~/components/blocks/editor-sidebar'
import Form from '~/components/form'
import type { Labels } from '~/components/kobun'
import { ScrollArea } from '~/components/ui/scroll-area'
import { SidebarProvider } from '~/components/ui/sidebar'
import { KobunContext, type KobunContextData } from '~/providers'

const EditorLayout = ({
	collectionSlug,
	labels,
}: {
	collectionSlug: string
	labels: Labels | undefined
}) => {
	const lastResult = useActionData()
	const { config } = useContext<KobunContextData>(KobunContext)
	invariant(
		config?.collections[collectionSlug],
		'Collection not found in config',
	)
	const collection = config.collections[collectionSlug]
	const primaryFields = Object.keys(collection.schema).filter(
		(key: SchemaKey) => key === 'title' || key === 'content',
	)
	const secondaryFields = Object.keys(collection.schema)
		.filter((key: SchemaKey) => key !== 'title' && key !== 'content')
		.filter(
			(key: SchemaKey) =>
				key !== 'createdAt' &&
				key !== 'publishedAt' &&
				key !== 'updatedAt',
		)

	const defaultValue = useLoaderData()

	const [form, fields] = useForm({
		defaultValue,
		lastResult,
		// constraint: getZodConstraint()
	})

	const [openCollectionSettings, setOpenCollectionSettings] = useState(false)

	const isContentFieldAvailable =
		Object.keys(collection.schema).findIndex((key) => key === 'content') !==
		-1

	return (
		<RRForm id={form.id} method='post' onSubmit={form.onSubmit}>
			<SidebarProvider
				className='rs-dark'
				onOpenChange={setOpenCollectionSettings}
				open={openCollectionSettings}
				style={{
					// @ts-ignore
					'--sidebar-width': '30rem',
				}}
			>
				<main className='rs-w-screen rs-h-screen rs-flex rs-flex-col rs-gap-4'>
					<EditorHeader
						collectionSlug={collectionSlug}
						defaultValue={defaultValue}
						isContentFieldAvailable={isContentFieldAvailable}
						openCollectionSettings={openCollectionSettings}
						setOpenCollectionSettings={setOpenCollectionSettings}
					/>
					<ScrollArea className='rs-w-full rs-h-full rs-p-8 rs-z-10'>
						<section className='rs-w-full rs-flex rs-justify-center'>
							<div className='rs-w-full rs-max-w-5xl rs-flex rs-flex-col rs-gap-4'>
								<Form
									fields={fields}
									isContentFieldAvailable={
										isContentFieldAvailable
									}
									primaryInputFields={primaryFields}
									schema={collection.schema}
									secondaryInputFields={secondaryFields}
								/>
							</div>
						</section>
					</ScrollArea>
				</main>
				{isContentFieldAvailable && (
					<EditorSidebar
						fields={fields}
						labels={labels}
						schema={collection.schema}
						secondaryInputFields={secondaryFields}
						setOpenCollectionSettings={setOpenCollectionSettings}
					/>
				)}
			</SidebarProvider>
		</RRForm>
	)
}

export default EditorLayout
