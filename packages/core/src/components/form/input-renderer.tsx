import type { FieldMetadata } from '@conform-to/react'
import {
	type ArrayField as ArrayFieldType,
	type BooleanField as BooleanFieldType,
	type DateField as DateFieldType,
	type DocumentField as DocumentFieldType,
	type Field,
	FieldTypes,
	type MultiSelectField as MultiSelectFieldType,
	type ObjectField as ObjectFieldType,
	type SchemaKey,
	type SelectField as SelectFieldType,
	type SlugField as SlugFieldType,
	type TextField as TextFieldType,
	type UrlField as UrlFieldType,
} from '@kobun/common'
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
import ArrayField from '~/components/form/fields/array'
import BooleanField from '~/components/form/fields/boolean'
import DateField from '~/components/form/fields/date'
import MultiSelectField from '~/components/form/fields/multiselect'
import ObjectField from '~/components/form/fields/object'
import SelectField from '~/components/form/fields/select'
import SlugField from '~/components/form/fields/slug'
import TextField from '~/components/form/fields/text'
import UrlField from '~/components/form/fields/url'
import { Textarea } from '~/components/ui/textarea'
import type { Layout } from '~/lib/types'

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
	layout,
}: {
	fields: Required<{
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		[x: string]: FieldMetadata<any, Record<string, any>, string[]>
	}>
	fieldData: Field & { type: FieldTypes }
	fieldKey: SchemaKey
	fieldMetadata: FieldMetadata
	layout: Layout
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
				placeholder:
					layout === 'editor'
						? 'Start writing or press "/" to insert content...'
						: '',
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
		case FieldTypes.ARRAY: {
			const data = fieldData as ArrayFieldType
			return (
				<ArrayField
					description={data.description}
					field={data.field}
					fields={fields}
					itemLabel={data.itemLabel}
					label={data.label}
					name={fieldMetadata.name}
				/>
			)
		}
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
		case FieldTypes.DATE: {
			const data = fieldData as DateFieldType
			return (
				<DateField
					description={data.description}
					label={data.label}
					name={fieldMetadata.name}
				/>
			)
		}
		case FieldTypes.DOCUMENT: {
			const data = fieldData as DocumentFieldType
			return (
				<>
					<Editor
						bodyFont={settings.bodyFont}
						description={data.description}
						editor={editor as TiptapEditor}
						label={data.label}
						layout={layout}
					/>
					<Textarea
						className='rs-hidden'
						name={fieldMetadata.name}
						ref={editorRef}
					/>
				</>
			)
		}
		case FieldTypes.MULTISELECT: {
			const data = fieldData as MultiSelectFieldType
			return (
				<MultiSelectField
					defaultOptions={
						data.defaultOptions ||
						(fieldMetadata.value as string[]) ||
						[]
					}
					description={data.description}
					label={data.label}
					name={fieldMetadata.name}
					options={data.options}
					placeholder={data.placeholder}
				/>
			)
		}
		case FieldTypes.OBJECT: {
			const data = fieldData as ObjectFieldType
			return (
				<ObjectField
					description={data.description}
					fields={fields}
					label={data.label}
					name={fieldMetadata.name}
					schema={data.schema}
				/>
			)
		}
		case FieldTypes.SELECT: {
			const data = fieldData as SelectFieldType
			return (
				<SelectField
					defaultOption={
						data.defaultOption ||
						(fieldMetadata.value as string) ||
						''
					}
					description={data.description}
					label={data.label}
					name={fieldMetadata.name}
					options={data.options}
					placeholder={data.placeholder}
				/>
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
			if (fieldKey === 'title' && layout === 'editor') {
				return (
					<Textarea
						autoFocus
						className={`rs-w-full rs-min-h-[48px] rs-border-0 rs-p-0 focus-visible:rs-ring-0 focus-visible:rs-ring-offset-0 rs-flex rs-items-center rs-resize-none rs-overflow-y-hidden rs-bg-transparent rs-text-xl rs-font-semibold rs-leading-snug rs-text-foreground focus:rs-outline-none lg:rs-text-3xl lg:rs-leading-snug rs-${settings?.titleFont}`}
						defaultValue={fieldMetadata.initialValue as string}
						name={fieldMetadata.name}
						placeholder='Untitled'
						ref={titleRef}
						rows={1}
					/>
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
		case FieldTypes.URL: {
			const data = fieldData as UrlFieldType
			return (
				<UrlField
					description={data.description}
					label={data.label}
					name={fieldMetadata.name}
					placeholder={data.placeholder}
				/>
			)
		}
	}
}

export default InputRenderer
