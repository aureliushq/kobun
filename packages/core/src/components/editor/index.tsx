import {
	BubbleMenu as BubbleMenuWrapper,
	EditorContent,
	type Editor as TiptapEditor,
} from '@tiptap/react'

import EditorToolbar from '~/components/editor/toolbar'
import { Label } from '~/components/ui/label'
import type { Layout } from '~/lib/types'
import { cn } from '~/lib/utils'

const Editor = ({
	bodyFont,
	description,
	editor,
	label,
	layout,
}: {
	bodyFont: string
	description?: string
	editor: TiptapEditor
	label: string
	layout: Layout
}) => {
	return (
		<>
			<BubbleMenuWrapper editor={editor}>
				<EditorToolbar editor={editor} />
			</BubbleMenuWrapper>
			<div className='rs-flex rs-items-center rs-justify-between rs-flex-wrap rs-gap-2'>
				{layout === 'form' && (
					<div className='rs-grid rs-gap-1.5 rs-leading-none'>
						<Label>{label}</Label>
						{description && (
							<p className='rs-text-sm rs-text-muted-foreground'>
								{description}
							</p>
						)}
					</div>
				)}
				<div
					className={cn(
						'rs-prose dark:rs-prose-invert rs-flex rs-w-full rs-items-start rs-justify-center',
						bodyFont,
						layout === 'form'
							? 'rs-border rs-border-border rs-rounded-md rs-w-full rs-max-w-4xl rs-px-2 [&>div]:rs-px-3 [&>div]:rs-py-2 [&>div]:rs-w-full [&>div]:rs-max-w-4xl [&>div>div]:rs-min-h-[120px]'
							: 'editor-wrapper rs-h-auto rs-min-h-max rs-pb-12 rs-px-2',
					)}
				>
					<EditorContent editor={editor} />
				</div>
			</div>
		</>
	)
}

export default Editor
