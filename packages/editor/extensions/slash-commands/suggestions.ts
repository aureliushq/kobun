import { SlashMenu } from "../../components/menus/slash-menu/slash-menu"
import { suggestionPopup } from "../suggestion-popup"
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

	...suggestionPopup<SlashCommandItem>(SlashMenu),
}
