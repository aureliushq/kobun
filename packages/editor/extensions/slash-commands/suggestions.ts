import { ReactRenderer } from "@tiptap/react"
import tippy, { type Instance } from "tippy.js"
import {
	SlashMenu,
	type SlashMenuRef,
} from "../../components/menus/slash-menu/slash-menu"
import { defaultSlashCommands } from "./commands"
import type { SlashCommandItem } from "./extension"

export const slashSuggestionOptions = {
	items: ({ query }: { query: string }): SlashCommandItem[] => {
		return defaultSlashCommands.filter((item) => {
			if (!query) return true
			const search = query.toLowerCase()
			return (
				item.title.toLowerCase().includes(search) ||
				item.searchTerms.some((term) => term.includes(search))
			)
		})
	},

	render: () => {
		let component: ReactRenderer<SlashMenuRef> | null = null
		let popup: Instance[] | null = null

		return {
			onStart: (props: any) => {
				component = new ReactRenderer(SlashMenu, {
					props: {
						items: props.items,
						command: props.command,
						query: props.query,
					},
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
				component?.updateProps({
					items: props.items,
					command: props.command,
					query: props.query,
				})

				if (props.clientRect) {
					popup?.[0]?.setProps({
						getReferenceClientRect: props.clientRect,
					})
				}
			},

			onKeyDown: (props: any) => {
				if (props.event.key === "Escape") {
					popup?.[0]?.hide()
					return true
				}
				// The editor keeps DOM focus, so cmdk never receives these
				// keys directly. Forward ArrowUp/Down/Enter to the SlashMenu
				// so it can drive selection and insertion.
				return component?.ref?.onKeyDown(props) ?? false
			},

			onExit: () => {
				popup?.[0]?.destroy()
				component?.destroy()
			},
		}
	},
}
