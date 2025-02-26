import {
	getTextareaProps,
	useInputControl,
	type FieldMetadata,
} from '@conform-to/react'
import {
	type BooleanField as BooleanFieldType,
	type Field,
	FieldTypes,
	type SchemaKey,
	type SlugField as SlugFieldType,
	type TextField as TextFieldType,
} from '@rescribe/common'
import { BubbleMenu } from '@tiptap/extension-bubble-menu'
import { CharacterCount } from '@tiptap/extension-character-count'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { FontFamily } from '@tiptap/extension-font-family'
import { Heading } from '@tiptap/extension-heading'
import { Highlight } from '@tiptap/extension-highlight'
import { Link as TiptapLink } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import { Youtube } from '@tiptap/extension-youtube'
import { type Editor as TiptapEditor, useEditor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { useEffect, useRef } from 'react'
import { Markdown } from 'tiptap-markdown'

import Editor from '~/components/editor'
import BooleanField from '~/components/form/fields/boolean'
import SlugField from '~/components/form/fields/slug'
import TextField from '~/components/form/fields/text'
import { Textarea } from '~/components/ui/textarea'

const lowlight = createLowlight(common)

type EditorData = {
	content: string
	title: string
	wordCount?: number
}

const InputRenderer = ({
	fields,
	fieldData,
	fieldKey,
	fieldMetadata,
}: {
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	fieldData: Field & { type: FieldTypes }
	fieldKey: SchemaKey
	fieldMetadata: FieldMetadata
}) => {
	const editorData = useRef<EditorData>({
		content: (fieldMetadata.initialValue as string) || '',
		title: '',
		wordCount: 0,
	})
	const content = editorData.current.content
	const wordCount = editorData.current.wordCount

	const editorRef = useRef<HTMLTextAreaElement>(null)
	const titleRef = useRef<HTMLTextAreaElement>(null)

	const settings = {
		bodyFont: 'rs-font-sans',
		titleFont: 'rs-font-sans',
	}

	const editor = useEditor({
		content,
		editorProps: {
			attributes: {
				class: '',
			},
		},
		extensions: [
			BubbleMenu.configure({
				tippyOptions: {
					arrow: true,
				},
			}),
			CodeBlockLowlight.configure({
				lowlight,
				HTMLAttributes: {
					class: 'not-prose hljs',
				},
			}),
			Youtube.configure({
				width: 762,
				height: 432,
			}),
			TiptapLink.configure({ openOnClick: false }),
			Placeholder.configure({
				placeholder: 'Start writing or press "/" to insert content...',
			}),
			Highlight.configure({ multicolor: true }),
			StarterKit.configure({
				code: {
					HTMLAttributes: {
						class: 'not-prose hljs',
					},
				},
				codeBlock: false,
				heading: false,
			}),
			CharacterCount,
			TextStyle,
			FontFamily,
			Underline,
			Heading,
			Markdown,
		],
		onCreate({ editor }) {
			const markdown = editor.isEmpty
				? ''
				: editor.storage.markdown.getMarkdown()
			const wordCount = editor.storage.characterCount.words()
			handleContentChange(markdown)
			// handleWordCountChange(wordCount)
		},
		onUpdate({ editor }) {
			const markdown = editor.isEmpty
				? ''
				: editor.storage.markdown.getMarkdown()
			const wordCount = editor.storage.characterCount.words()
			handleContentChange(markdown)
			// handleWordCountChange(wordCount)
		},
		// fix for hydration issues
		immediatelyRender: false,
	})

	const handleContentChange = (markdown: string) => {
		editorData.current.content = markdown
		if (editorRef.current) {
			editorRef.current.value = markdown
		}
	}

	// biome-ignore lint: correctness/useExhaustiveDependencies
	useEffect(() => {
		if (!fields.title.value && !content) {
			titleRef.current?.focus()
		} else if (!content) {
			editor?.commands.focus('end')
		} else {
			titleRef.current?.focus()
		}
	}, [])

	// biome-ignore lint: correctness/useExhaustiveDependencies
	useEffect(() => {
		if (fieldKey === 'title') {
			const textarea = titleRef.current
			if (textarea) {
				textarea.style.height = 'inherit'
				textarea.style.height = `${textarea.scrollHeight}px`
			}
		}
	}, [fields.title.value])

	switch (fieldData.type) {
		case FieldTypes.BOOLEAN: {
			const data = fieldData as BooleanFieldType

			return (
				<BooleanField
					component={data.component}
					config={{
						defaultChecked: fieldMetadata.initialValue as boolean,
						id: 'accept-terms-checkbox',
					}}
					description={data.description}
					label={data.label}
					name={fieldMetadata.name}
				/>
			)
		}
		case FieldTypes.DOCUMENT: {
			return (
				<>
					<Editor
						bodyFont={settings.bodyFont}
						editor={editor as TiptapEditor}
					/>
					<textarea
						className='rs-hidden'
						{...getTextareaProps(fieldMetadata)}
						ref={editorRef}
					/>
				</>
			)
		}
		case FieldTypes.SLUG: {
			const data = fieldData as SlugFieldType

			return (
				<SlugField
					config={{
						defaultValue: fieldMetadata.initialValue as string,
					}}
					description={data.description}
					label={data.label}
					name={fieldMetadata.name}
					placeholder={data.placeholder}
				/>
			)
		}
		case FieldTypes.TEXT: {
			const data = fieldData as TextFieldType

			if (fieldKey === 'title') {
				return (
					<div className='rs-px-2'>
						<Textarea
							autoFocus
							className={`rs-w-full rs-min-h-[48px] rs-border-0 rs-p-0 focus-visible:rs-ring-0 focus-visible:rs-ring-offset-0 rs-flex rs-items-center rs-resize-none rs-overflow-y-hidden rs-bg-transparent rs-text-xl rs-font-semibold rs-leading-snug rs-text-foreground focus:rs-outline-none lg:rs-text-3xl lg:rs-leading-snug rs-${settings?.titleFont}`}
							defaultValue={fieldMetadata.initialValue as string}
							name={fieldMetadata.name}
							placeholder='Untitled'
							ref={titleRef}
							rows={1}
						/>
					</div>
				)
			}

			return (
				<TextField
					config={{
						defaultValue: fieldMetadata.initialValue as string,
					}}
					description={data.description}
					htmlType={data.type}
					label={data.label}
					multiline={data.multiline}
					name={fieldMetadata.name}
				/>
			)
		}
	}
}

export default InputRenderer
