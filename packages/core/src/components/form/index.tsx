import type { FieldMetadata } from '@conform-to/react'
import type { SchemaKey } from '@rescribe/common'
import { PanelRightIcon } from 'lucide-react'
import { type Dispatch, type SetStateAction, useContext } from 'react'
import invariant from 'tiny-invariant'

import InputRenderer from '~/components/form/input-renderer'
import type { Labels } from '~/components/rescribe'
import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '~/components/ui/sheet'
import { RescribeContext, type RescribeContextData } from '~/providers'

const Form = ({
	fields,
	isContentFieldAvailable,
	labels,
	openCollectionSettings,
	setOpenCollectionSettings,
}: {
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	isContentFieldAvailable: boolean
	labels: Labels | undefined
	openCollectionSettings: boolean
	setOpenCollectionSettings: Dispatch<SetStateAction<boolean>>
}) => {
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	invariant(params?.collection, 'Invalid collection key in url')
	invariant(
		config?.collections[params.collection],
		'Collection not found in config',
	)

	const collection = config.collections[params.collection]
	const primaryFields = Object.keys(collection.schema).filter(
		(key: SchemaKey) => key === 'title' || key === 'content',
	)
	const otherFields = Object.keys(collection.schema)
		.filter((key: SchemaKey) => key !== 'title' && key !== 'content')
		.filter(
			(key: SchemaKey) =>
				key !== 'createdAt' &&
				key !== 'publishedAt' &&
				key !== 'updatedAt',
		)

	const PrimaryInputs =
		primaryFields.length > 0
			? primaryFields.map((key) => {
					const fieldData = collection.schema[key]
					const fieldMetadata = fields[key]
					return (
						<InputRenderer
							fields={fields}
							// TODO: fix this type
							// @ts-ignore
							fieldData={fieldData}
							fieldKey={key}
							fieldMetadata={fieldMetadata}
							key={key}
						/>
					)
				})
			: null

	const OtherInputs =
		otherFields.length > 0
			? otherFields.map((key) => {
					const fieldData = collection.schema[key]
					const fieldMetadata = fields[key]
					return (
						<InputRenderer
							fields={fields}
							// TODO: fix this type
							// @ts-ignore
							fieldData={fieldData}
							fieldKey={key}
							fieldMetadata={fieldMetadata}
							key={key}
						/>
					)
				})
			: null

	return (
		<>
			<section className='rs-flex rs-h-full rs-w-full rs-flex-grow rs-flex-col rs-items-center rs-justify-start rs-z-9'>
				<div className='rs-flex rs-h-full rs-w-full rs-flex-col rs-items-center rs-justify-start rs-gap-6 rs-px-4 rs-pb-24 md:rs-pb-16 lg:rs-px-0'>
					<div className='rs-w-full rs-max-w-2xl rs-flex rs-flex-col rs-px-2 rs-gap-6'>
						{PrimaryInputs}
						{!isContentFieldAvailable && OtherInputs}
					</div>
				</div>
			</section>
			{isContentFieldAvailable && (
				<Sheet
					onOpenChange={setOpenCollectionSettings}
					open={openCollectionSettings}
				>
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
						<ScrollArea className='rs-w-full rs-h-full'>
							<div className='rs-flex rs-flex-col rs-gap-8 rs-px-2 rs-py-8'>
								{OtherInputs}
							</div>
						</ScrollArea>
					</SheetContent>
				</Sheet>
			)}
		</>
	)
}

export default Form
