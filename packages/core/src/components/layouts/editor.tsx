import { useContext, useState } from 'react'
import { Form as RRForm, useActionData } from 'react-router'
import { useForm } from '@conform-to/react'

import EditorHeader from '@/components/blocks/editor-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import Form from '../form'
import type { Labels } from '../rescribe'
import { type RescribeContextData, RescribeContext } from '@/providers'
import invariant from 'tiny-invariant'

const EditorLayout = ({
	labels,
}: {
	labels: Labels | undefined
}) => {
	const lastResult = useActionData()
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	invariant(params?.collection, 'Invalid collection key in url')
	invariant(
		config?.collections[params.collection],
		'Collection not found in config',
	)

	const [form, fields] = useForm({
		lastResult,
		// constraint: getZodConstraint()
	})
	const [openCollectionSettings, setOpenCollectionSettings] = useState(false)

	const collection = config.collections[params.collection]
	const isContentFieldAvailable =
		Object.keys(collection.schema).findIndex((key) => key === 'content') !==
		-1

	return (
		<main className='rs-w-screen rs-h-screen rs-flex rs-flex-col rs-gap-4'>
			<RRForm id={form.id} method='post' onSubmit={form.onSubmit}>
				<EditorHeader
					isContentFieldAvailable={isContentFieldAvailable}
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
