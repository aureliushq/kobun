import HorizontalRule from "@tiptap/extension-horizontal-rule"
import { nodeInputRule } from "@tiptap/core"

export const CustomHorizontalRuleExtension = HorizontalRule.extend({
	addInputRules() {
		return [
			nodeInputRule({
				find: /^(?:---|—-|___\s|\*\*\*\s)$/,
				type: this.type,
			}),
		]
	},
}).configure({
	HTMLAttributes: { class: "my-6 border-border" },
})
