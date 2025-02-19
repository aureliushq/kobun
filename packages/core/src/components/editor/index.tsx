import {
	BubbleMenu as BubbleMenuWrapper,
	EditorContent,
	type Editor as TiptapEditor,
} from '@tiptap/react'
import EditorToolbar from './toolbar'

const Editor = ({
	bodyFont,
	editor,
}: { bodyFont: string; editor: TiptapEditor }) => {
	return (
		<>
			<BubbleMenuWrapper editor={editor}>
				<EditorToolbar editor={editor} />
			</BubbleMenuWrapper>
			<div
				className={`editor-wrapper rs-prose dark:rs-prose-invert rs-flex rs-h-auto rs-min-h-max rs-w-full rs-items-start rs-justify-center rs-pb-12 ${bodyFont}`}
			>
				<EditorContent editor={editor} />
			</div>
		</>
	)
}

export default Editor
