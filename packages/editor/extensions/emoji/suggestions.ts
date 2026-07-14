// biome-ignore-all lint/suspicious/noExplicitAny: suggestion renderer props are not exported
import type { Editor } from "@tiptap/core"
import type { EmojiItem } from "@tiptap/extension-emoji"
import { ReactRenderer } from "@tiptap/react"
import tippy, { type Instance } from "tippy.js"
import {
	EmojiMenu,
	type EmojiMenuRef,
} from "../../components/menus/emoji-menu/emoji-menu"

const MAX_RESULTS = 50

export const emojiSuggestionOptions = {
	items: ({
		editor,
		query,
	}: {
		editor: Editor
		query: string
	}): EmojiItem[] => {
		const search = query.toLowerCase()

		return (editor.storage.emoji.emojis as EmojiItem[])
			.filter((item) => {
				if (!item.emoji) return false
				if (!search) return true

				return (
					item.name.includes(search) ||
					item.shortcodes.some((shortcode) => shortcode.includes(search)) ||
					item.tags.some((tag) => tag.includes(search))
				)
			})
			.slice(0, MAX_RESULTS)
	},

	render: () => {
		let component: ReactRenderer<EmojiMenuRef> | null = null
		let popup: Instance[] | null = null

		return {
			onStart: (props: any) => {
				component = new ReactRenderer(EmojiMenu, {
					props: { items: props.items, command: props.command },
					editor: props.editor,
				})

				if (!props.clientRect) return

				popup = tippy("body", {
					getReferenceClientRect: props.clientRect,
					appendTo: () => document.body,
					content: component.element,
					showOnCreate: true,
					interactive: true,
					trigger: "manual",
					placement: "bottom-start",
				})
			},

			onUpdate: (props: any) => {
				component?.updateProps({ items: props.items, command: props.command })
				if (props.clientRect) {
					popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect })
				}
			},

			onKeyDown: (props: any) => {
				return component?.ref?.onKeyDown(props) ?? false
			},

			onExit: () => {
				popup?.[0]?.destroy()
				component?.destroy()
				popup = null
				component = null
			},
		}
	},
}
