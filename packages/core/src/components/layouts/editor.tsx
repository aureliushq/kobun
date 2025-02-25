import { useForm } from '@conform-to/react'
import { useContext, useState } from 'react'
import { Form as RRForm, useActionData, useLoaderData } from 'react-router'
import invariant from 'tiny-invariant'

import EditorHeader from '~/components/blocks/editor-header'
import Form from '~/components/form'
import type { Labels } from '~/components/rescribe'
import { ScrollArea } from '~/components/ui/scroll-area'
import { RescribeContext, type RescribeContextData } from '~/providers'

const EditorLayout = ({
	collectionSlug,
	labels,
}: {
	collectionSlug: string
	labels: Labels | undefined
}) => {
	const lastResult = useActionData()
	const { config } = useContext<RescribeContextData>(RescribeContext)
	invariant(
		config?.collections[collectionSlug],
		'Collection not found in config',
	)
	const collection = config.collections[collectionSlug]

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
		<main className='rs-w-screen rs-h-screen rs-flex rs-flex-col rs-gap-4'>
			<RRForm id={form.id} method='post' onSubmit={form.onSubmit}>
				<EditorHeader
					collectionSlug={collectionSlug}
					defaultValue={defaultValue}
					isContentFieldAvailable={isContentFieldAvailable}
					setOpenCollectionSettings={setOpenCollectionSettings}
				/>
				<ScrollArea className='rs-w-full rs-h-full rs-p-8 rs-z-10'>
					<section className='rs-w-full rs-flex rs-justify-center'>
						<div className='rs-w-full rs-max-w-5xl rs-flex rs-flex-col rs-gap-4'>
							<Form
								collectionSlug={collectionSlug}
								fields={fields}
								isContentFieldAvailable={
									isContentFieldAvailable
								}
								labels={labels}
								openCollectionSettings={openCollectionSettings}
								setOpenCollectionSettings={
									setOpenCollectionSettings
								}
							/>
						</div>
					</section>
				</ScrollArea>
			</RRForm>
		</main>
	)
}

export default EditorLayout
