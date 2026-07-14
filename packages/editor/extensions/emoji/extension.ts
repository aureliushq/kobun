import Emoji, { emojis, shortcodeToEmoji } from "@tiptap/extension-emoji"
import { emojiSuggestionOptions } from "./suggestions"

const unicodeEmojis = emojis.map((emoji) => ({
	...emoji,
	fallbackImage: undefined,
}))

export const CustomEmojiExtension = Emoji.extend({
	renderMarkdown(node) {
		if (!node.attrs?.name) return ""

		return (
			shortcodeToEmoji(node.attrs.name, emojis)?.emoji ?? `:${node.attrs.name}:`
		)
	},
}).configure({
	emojis: unicodeEmojis,
	suggestion: emojiSuggestionOptions,
})
