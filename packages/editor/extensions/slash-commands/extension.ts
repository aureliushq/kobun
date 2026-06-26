import type { Editor, Range } from "@tiptap/core"
import { Extension } from "@tiptap/core"
import { PluginKey } from "@tiptap/pm/state"
import { Suggestion } from "@tiptap/suggestion"
import { slashSuggestionOptions } from "./suggestions"

export interface SlashCommandItem {
	title: string
	description: string
	icon: React.ComponentType<{ className?: string }>
	searchTerms: string[]
	command: (props: { editor: Editor; range: Range }) => void
}

const slashCommandPluginKey = new PluginKey("slashCommands")

export const SlashCommandsExtension = Extension.create({
	name: "slashCommands",

	addOptions() {
		return {
			suggestion: {
				char: "/",
				pluginKey: slashCommandPluginKey,
				command: ({
					editor,
					range,
					props,
				}: {
					editor: Editor
					range: Range
					props: SlashCommandItem
				}) => {
					props.command({ editor, range })
				},
				allow: ({ editor }: { editor: Editor }) => {
					return !editor.isActive("codeBlock")
				},
				...slashSuggestionOptions,
			},
		}
	},

	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				...this.options.suggestion,
			}),
		]
	},
})
