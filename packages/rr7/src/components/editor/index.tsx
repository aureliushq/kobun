import { type ChangeEvent, useEffect, useRef } from 'react'
import { Link } from 'react-router'
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
import {
	BubbleMenu as BubbleMenuWrapper,
	EditorContent,
	type Editor as TiptapEditor,
	useEditor,
} from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { Textarea } from '../ui/textarea'
import EditorToolbar from './toolbar'

const lowlight = createLowlight(common)

type EditorData = {
	content: string
	title: string
	wordCount?: number
	// // biome-ignore lint: suspicious/noExplicitAny
	// [key: string]: any
}

const Editor = () => {
	const editorData = useRef<EditorData>({
		content: '',
		title: '',
		wordCount: 0,
	})
	const content = editorData.current.content
	const title = editorData.current.title
	const wordCount = editorData.current.wordCount

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
				placeholder: 'Start writing...',
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
			Heading.configure({
				levels: [2, 3, 4],
			}),
		],
		onCreate({ editor }) {
			const html = editor.isEmpty ? '' : editor.getHTML()
			const wordCount = editor.storage.characterCount.words()
			// handleContentChange(html)
			// handleWordCountChange(wordCount)
		},
		onUpdate({ editor }) {
			const html = editor.isEmpty ? '' : editor.getHTML()
			const wordCount = editor.storage.characterCount.words()
			// handleContentChange(html)
			// handleWordCountChange(wordCount)
		},
		// fix for hydration issues
		immediatelyRender: false,
	})

	const contentRef = useRef<HTMLTextAreaElement>(null)
	const titleRef = useRef<HTMLTextAreaElement>(null)

	// biome-ignore lint: correctness/useExhaustiveDependencies
	useEffect(() => {
		if (!title && !content) {
			titleRef.current?.focus()
		} else if (!content) {
			editor?.commands.focus('end')
		} else {
			titleRef.current?.focus()
		}
	}, [])

	// biome-ignore lint: correctness/useExhaustiveDependencies
	useEffect(() => {
		const textarea = titleRef.current
		if (textarea) {
			textarea.style.height = 'inherit'
			textarea.style.height = `${textarea.scrollHeight}px`
		}
	}, [title])

	const handleTitleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		editorData.current.title = e.target.value
	}

	return (
		<>
			<BubbleMenuWrapper editor={editor}>
				<EditorToolbar editor={editor} />
			</BubbleMenuWrapper>
			<section className='rs-flex rs-h-full rs-w-full rs-flex-grow rs-flex-col rs-items-center rs-justify-start rs-z-9'>
				<div className='rs-flex rs-h-full rs-w-full rs-flex-col rs-items-center rs-justify-start rs-gap-6 rs-px-4 rs-pb-24 md:rs-pb-16 lg:rs-px-0'>
					<div className='rs-w-full rs-max-w-2xl'>
						<Textarea
							autoFocus
							className={`rs-w-full rs-min-h-[48px] rs-border-0 rs-p-0 focus-visible:rs-ring-0 focus-visible:rs-ring-offset-0 rs-flex rs-items-center rs-resize-none rs-overflow-y-hidden rs-bg-transparent rs-text-xl rs-font-semibold rs-leading-snug rs-text-foreground focus:rs-outline-none lg:rs-text-3xl lg:rs-leading-snug rs-${settings?.titleFont}`}
							// onBlur={onTitleBlur}
							onChange={handleTitleChange}
							placeholder='Untitled'
							ref={titleRef}
							rows={1}
							value={title}
						/>
					</div>
					<div
						className={`editor-wrapper rs-prose dark:rs-prose-invert rs-flex rs-h-auto rs-min-h-max rs-w-full rs-items-start rs-justify-center rs-pb-12 ${settings?.bodyFont}`}
					>
						<EditorContent editor={editor} />
					</div>
				</div>
			</section>
		</>
	)
}

export default Editor
