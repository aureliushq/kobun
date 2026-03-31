import type { Editor } from "@tiptap/react"
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus"
import {
	Bold,
	Code,
	Italic,
	Link,
	Strikethrough,
	Underline as UnderlineIcon,
} from "lucide-react"
import { useCallback, useState } from "react"
import { Button } from "@/ui/components/base/button"
import { Separator } from "@/ui/components/base/separator"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/ui/components/base/tooltip"
import { LinkSelector } from "./link-selector"

interface EditorBubbleMenuProps {
	editor: Editor
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
	const [showLinkSelector, setShowLinkSelector] = useState(false)

	const formatButtons = [
		{
			name: "bold",
			label: "Bold",
			shortcut: "⌘B",
			icon: Bold,
			action: () => editor.chain().focus().toggleBold().run(),
			isActive: editor.isActive("bold"),
		},
		{
			name: "italic",
			label: "Italic",
			shortcut: "⌘I",
			icon: Italic,
			action: () => editor.chain().focus().toggleItalic().run(),
			isActive: editor.isActive("italic"),
		},
		{
			name: "underline",
			label: "Underline",
			shortcut: "⌘U",
			icon: UnderlineIcon,
			action: () => editor.chain().focus().toggleUnderline().run(),
			isActive: editor.isActive("underline"),
		},
		{
			name: "strikethrough",
			label: "Strikethrough",
			shortcut: "⌘⇧S",
			icon: Strikethrough,
			action: () => editor.chain().focus().toggleStrike().run(),
			isActive: editor.isActive("strike"),
		},
		{
			name: "code",
			label: "Inline Code",
			shortcut: "⌘E",
			icon: Code,
			action: () => editor.chain().focus().toggleCode().run(),
			isActive: editor.isActive("code"),
		},
	]

	const handleSetLink = useCallback(
		(url: string) => {
			if (url === "") {
				editor.chain().focus().extendMarkRange("link").unsetLink().run()
			} else {
				editor
					.chain()
					.focus()
					.extendMarkRange("link")
					.setLink({ href: url, target: "_blank" })
					.run()
			}
			setShowLinkSelector(false)
		},
		[editor],
	)

	return (
		<TiptapBubbleMenu
			editor={editor}
			shouldShow={({ editor, from, to }) => {
				if (editor.isActive("codeBlock")) return false
				return from !== to
			}}
		>
			<TooltipProvider>
				<div className="flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-md">
					{formatButtons.map((button) => {
						const Icon = button.icon
						return (
							<Tooltip key={button.name}>
								<TooltipTrigger
									render={
										<Button
											variant={button.isActive ? "secondary" : "ghost"}
											size="icon-sm"
											onClick={button.action}
										/>
									}
								>
									<Icon />
								</TooltipTrigger>
								<TooltipContent>
									{button.label} ({button.shortcut})
								</TooltipContent>
							</Tooltip>
						)
					})}

					<Separator orientation="vertical" className="mx-0.5 h-4" />

					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant={editor.isActive("link") ? "secondary" : "ghost"}
									size="icon-sm"
									onClick={() => setShowLinkSelector(!showLinkSelector)}
								/>
							}
						>
							<Link />
						</TooltipTrigger>
						<TooltipContent>Link</TooltipContent>
					</Tooltip>

					{showLinkSelector && (
						<LinkSelector
							editor={editor}
							onSetLink={handleSetLink}
							onClose={() => setShowLinkSelector(false)}
						/>
					)}
				</div>
			</TooltipProvider>
		</TiptapBubbleMenu>
	)
}
