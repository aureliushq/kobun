import type { FieldMetadata } from '@conform-to/react'
import type { ConfigSchema, SchemaKey } from '@runica/common'
import type { Dispatch, SetStateAction } from 'react'

import InputRenderer from '~/components/form/input-renderer'
import type { Labels } from '~/components/rescribe'
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarSeparator,
} from '~/components/ui/sidebar'
import { Button } from '../ui/button'
import { PanelRightIcon } from 'lucide-react'
import { ScrollArea } from '../ui/scroll-area'

const EditorSidebar = <T extends SchemaKey>({
	fields,
	labels,
	schema,
	secondaryInputFields,
	setOpenCollectionSettings,
}: {
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	labels: Labels | undefined
	schema: ConfigSchema<T>
	secondaryInputFields: string[]
	setOpenCollectionSettings: Dispatch<SetStateAction<boolean>>
}) => {
	const SecondaryInputs =
		secondaryInputFields.length > 0
			? secondaryInputFields.map((key) => {
					const fieldData = schema[key as T]
					const fieldMetadata = fields[key as string]
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
		<Sidebar
			className='[&>div]:rs-bg-transparent rs-border-l rs-border-border'
			side='right'
		>
			<SidebarHeader className='rs-h-16 rs-px-4 rs-flex rs-flex-row rs-items-center rs-justify-between rs-space-y-0'>
				<h2 className='rs-text-lg rs-font-semibold rs-text-foreground'>{`${labels?.singular} Settings`}</h2>
				<Button
					onClick={() => setOpenCollectionSettings(false)}
					size='icon'
					variant='ghost'
				>
					<PanelRightIcon />
				</Button>
			</SidebarHeader>
			<SidebarSeparator className='rs-mx-0' />
			<SidebarContent>
				<ScrollArea className='rs-w-full rs-h-full'>
					<div className='rs-flex rs-flex-col rs-gap-8 rs-px-2 rs-py-8'>
						{SecondaryInputs}
					</div>
				</ScrollArea>
			</SidebarContent>
		</Sidebar>
	)
}

export default EditorSidebar
