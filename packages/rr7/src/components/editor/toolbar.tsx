import { useCallback, useEffect, useState } from 'react'

import type { Editor } from '@tiptap/react'
import {
	BoldIcon,
	CodeIcon,
	HighlighterIcon,
	ItalicIcon,
	LinkIcon,
	QuoteIcon,
	UnderlineIcon,
} from 'lucide-react'
import LinkDialog from '@/components/editor/link-dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Toolbar } from '@/components/ui/toolbar'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip'

enum EditorHeadings {
	NORMAL = 'normal',
	H2 = 'h2',
	H3 = 'h3',
	H4 = 'h4',
}

enum EditorMarks {
	BOLD = 'bold',
	ITALIC = 'italic',
	UNDERLINE = 'underline',
	LINK = 'link',
	HIGHLIGHT = 'highlight',
}

enum EditorNodes {
	CODE = 'codeBlock',
	QUOTE = 'blockquote',
}

const EditorToolbar = ({ editor }: { editor: Editor | null }) => {
	const EDITOR_HEADINGS = [
		{ label: 'Normal', value: EditorHeadings.NORMAL },
		{ label: 'Heading 2', value: EditorHeadings.H2 },
		{ label: 'Heading 3', value: EditorHeadings.H3 },
		{ label: 'Heading 4', value: EditorHeadings.H4 },
	]

	const [activeHeadingMark, setActiveHeadingMark] = useState<string>(
		EditorHeadings.NORMAL,
	)
	const [activeMarks, setActiveMarks] = useState<string[]>([])
	const [activeNodes, setActiveNodes] = useState<string[]>([])
	const [linkOpen, setLinkOpen] = useState<boolean>(false)

	const handleEditorMarksChange = (values: string[]) => {
		setActiveMarks(values)

		const changedToggle =
			values.find((value) => !activeMarks.includes(value)) ||
			activeMarks.find((value) => !values.includes(value))

		if (changedToggle) {
			switch (changedToggle) {
				case EditorMarks.BOLD:
					// @ts-ignore
					editor?.chain().focus().toggleBold().run()
					break
				case EditorMarks.ITALIC:
					// @ts-ignore
					editor?.chain().focus().toggleItalic().run()
					break
				case EditorMarks.UNDERLINE:
					editor?.chain().focus().toggleUnderline().run()
					break
				case EditorMarks.HIGHLIGHT:
					editor?.chain().focus().toggleHighlight().run()
					break
				case EditorMarks.LINK:
					setLinkOpen(true)
					break
			}
		}
	}

	const handleEditorHeadingMarkChange = (value: string) => {
		setActiveHeadingMark(value)

		switch (value) {
			case EditorHeadings.NORMAL:
				// @ts-ignore
				editor?.chain().focus().setParagraph().run()
				break
			case EditorHeadings.H2:
				editor?.chain().focus().toggleHeading({ level: 2 }).run()
				break
			case EditorHeadings.H3:
				editor?.chain().focus().toggleHeading({ level: 3 }).run()
				break
			case EditorHeadings.H4:
				editor?.chain().focus().toggleHeading({ level: 4 }).run()
				break
		}
	}

	const handleEditorNodesChange = (values: string[]) => {
		setActiveNodes(values)

		const changedToggle =
			values.find((value) => !activeNodes.includes(value)) ||
			activeNodes.find((value) => !values.includes(value))

		if (changedToggle) {
			switch (changedToggle) {
				case EditorNodes.CODE:
					editor?.chain().focus().toggleCodeBlock().run()
					break
				case EditorNodes.QUOTE:
					// @ts-ignore
					editor?.chain().focus().toggleBlockquote().run()
					break
			}
		}
	}

	const handleSetLink = useCallback(
		(link: string) => {
			if (link === null) {
				return
			}

			if (link === '') {
				editor
					?.chain()
					.focus()
					.extendMarkRange('link')
					.unsetLink()
					.run()
				setLinkOpen(false)
				return
			}

			editor
				?.chain()
				.focus()
				.extendMarkRange('link')
				.setLink({ href: link })
				.run()
			setLinkOpen(false)
		},
		[editor],
	)

	useEffect(() => {
		if (editor) {
			editor.on('selectionUpdate', ({ editor }) => {
				if (editor.isActive('heading', { level: 2 })) {
					setActiveHeadingMark(EditorHeadings.H2)
				} else if (editor.isActive('heading', { level: 3 })) {
					setActiveHeadingMark(EditorHeadings.H3)
				} else if (editor.isActive('heading', { level: 4 })) {
					setActiveHeadingMark(EditorHeadings.H4)
				} else {
					setActiveHeadingMark(EditorHeadings.NORMAL)
				}
			})
		}
	}, [editor])

	return (
		<>
			<Toolbar className='rs-flex rs-items-center rs-divide-x rs-divide-border rs-h-9 rs-p-0 rs-space-x-0'>
				<ToggleGroup
					className='rs-h-full rs-gap-0 rs-divide-x rs-divide-border rs-rounded-tl-md rs-rounded-bl-md rs-rounded-none rs-overflow-hidden'
					onValueChange={handleEditorMarksChange}
					type='multiple'
					value={activeMarks}
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								className='rs-h-9 rs-w-9 rs-rounded-tl-md rs-rounded-bl-md rs-rounded-tr-none rs-rounded-br-none'
								data-state={
									editor?.isActive(EditorMarks.BOLD)
										? 'on'
										: 'off'
								}
								value={EditorMarks.BOLD}
							>
								<BoldIcon className='rs-w-4 rs-h-4' />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>Bold</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								className='rs-h-9 rs-w-9 rs-rounded-none'
								data-state={
									editor?.isActive(EditorMarks.ITALIC)
										? 'on'
										: 'off'
								}
								value={EditorMarks.ITALIC}
							>
								<ItalicIcon className='rs-w-4 rs-h-4' />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>Italic</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								className='rs-h-9 rs-w-9 rs-rounded-none'
								data-state={
									editor?.isActive(EditorMarks.UNDERLINE)
										? 'on'
										: 'off'
								}
								value={EditorMarks.UNDERLINE}
							>
								<UnderlineIcon className='rs-w-4 rs-h-4' />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>Underline</p>
						</TooltipContent>
					</Tooltip>
				</ToggleGroup>
				<Select
					onValueChange={handleEditorHeadingMarkChange}
					value={activeHeadingMark}
				>
					<SelectTrigger className='rs-w-[180px] rs-h-9 rs-rounded-none -rs-ml-px'>
						<SelectValue placeholder='Headings' />
					</SelectTrigger>
					<SelectContent>
						{EDITOR_HEADINGS.map((heading) => (
							<SelectItem
								key={heading.value}
								value={heading.value}
							>
								{heading.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<ToggleGroup
					className='rs-h-full rs-gap-0 rs-divide-x rs-divide-border rs-rounded-none rs-overflow-hidden -rs-ml-px'
					onValueChange={handleEditorMarksChange}
					type='multiple'
					value={activeMarks}
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								className='rs-h-9 rs-w-9 rs-rounded-none'
								data-state={
									editor?.isActive(EditorMarks.HIGHLIGHT)
										? 'on'
										: 'off'
								}
								value={EditorMarks.HIGHLIGHT}
							>
								<HighlighterIcon className='rs-w-4 rs-h-4' />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>Highlight</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								className='rs-h-9 rs-w-9 rs-rounded-none'
								data-state={
									editor?.isActive(EditorMarks.LINK)
										? 'on'
										: 'off'
								}
								value={EditorMarks.LINK}
							>
								<LinkIcon className='rs-w-4 rs-h-4' />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>Link</p>
						</TooltipContent>
					</Tooltip>
				</ToggleGroup>

				<ToggleGroup
					className='rs-h-full rs-gap-0 rs-divide-x rs-divide-border rs-rounded-tr-md rs-rounded-br-md rs-rounded-none rs-overflow-hidden -rs-ml-px'
					onValueChange={handleEditorNodesChange}
					type='multiple'
					value={activeNodes}
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								className='rs-h-9 rs-w-9 rs-rounded-none'
								data-state={
									editor?.isActive(EditorNodes.CODE)
										? 'on'
										: 'off'
								}
								value={EditorNodes.CODE}
							>
								<CodeIcon className='rs-w-4 rs-h-4' />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>Code Block</p>
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<ToggleGroupItem
								className='rs-h-9 rs-w-9 rs-rounded-none'
								data-state={
									editor?.isActive(EditorNodes.QUOTE)
										? 'on'
										: 'off'
								}
								value={EditorNodes.QUOTE}
							>
								<QuoteIcon className='rs-w-4 rs-h-4' />
							</ToggleGroupItem>
						</TooltipTrigger>
						<TooltipContent>
							<p>Blockquote</p>
						</TooltipContent>
					</Tooltip>
				</ToggleGroup>
			</Toolbar>
			<LinkDialog
				defaultValue={editor?.getAttributes('link').href}
				handleSetLink={handleSetLink}
				onOpenChange={setLinkOpen}
				open={linkOpen}
			/>
		</>
	)
}

export default EditorToolbar
