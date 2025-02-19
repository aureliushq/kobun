import InputRenderer from '@/components/form/input-renderer'
import type { Labels } from '@/components/rescribe'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet'
import { RescribeContext, type RescribeContextData } from '@/providers'
import type { SchemaKey } from '@/types'
import { useForm } from '@conform-to/react'
import { PanelRightIcon } from 'lucide-react'
import { type Dispatch, type SetStateAction, useContext } from 'react'
import { Form as RRForm, useActionData } from 'react-router'
import invariant from 'tiny-invariant'

const Form = ({
	labels,
	openCollectionSettings,
	setOpenCollectionSettings,
}: {
	labels: Labels | undefined
	openCollectionSettings: boolean
	setOpenCollectionSettings: Dispatch<SetStateAction<boolean>>
}) => {
	const lastResult = useActionData()
	const { config, params } = useContext<RescribeContextData>(RescribeContext)
	const [form, fields] = useForm({
		lastResult,
		// constraint: getZodConstraint()
	})

	invariant(params?.collection, 'Invalid collection key in url')
	invariant(
		config?.collections[params.collection],
		'Collection not found in config',
	)

	const collection = config.collections[params.collection]
	const contentFields = Object.keys(collection.schema).filter(
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

	console.log(contentFields)
	console.log(otherFields)

	const ContentInputs =
		contentFields.length > 0
			? contentFields.map((key) => {
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
		<RRForm id={form.id} method='post'>
			<section className='rs-flex rs-h-full rs-w-full rs-flex-grow rs-flex-col rs-items-center rs-justify-start rs-z-9'>
				<div className='rs-flex rs-h-full rs-w-full rs-flex-col rs-items-center rs-justify-start rs-gap-6 rs-px-4 rs-pb-24 md:rs-pb-16 lg:rs-px-0'>
					{ContentInputs}
				</div>
			</section>
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
					<Separator />
					<ScrollArea className='rs-w-full rs-h-full'>
						<div className='rs-flex rs-flex-col rs-gap-8 rs-px-2 rs-py-8'>
							{OtherInputs}
						</div>
					</ScrollArea>
				</SheetContent>
			</Sheet>
		</RRForm>
	)
}

export default Form
