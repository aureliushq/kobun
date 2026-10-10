import type { Editor } from "@tiptap/core"
import type { EmojiItem } from "@tiptap/extension-emoji"
import { EmojiMenu } from "../../components/menus/emoji-menu/emoji-menu"
import { suggestionPopup } from "../suggestion-popup"

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

	...suggestionPopup<EmojiItem>(EmojiMenu),
}
