import { describe, expect, it } from "vitest"
import { htmlToMarkdown, markdownToHtml } from "./markdown"

describe("markdown utilities", () => {
	it("roundtrips CommonMark and GFM content", () => {
		const markdown = [
			"# Title",
			"",
			"A **bold** paragraph with ~~removed~~ text and [a link](https://example.com).",
			"",
			"- first",
			"- second",
			"",
			"> quoted",
		].join("\n")

		const html = markdownToHtml(markdown)

		expect(html).toContain("<h1>Title</h1>")
		expect(html).toContain("<s>removed</s>")
		expect(htmlToMarkdown(html)).toBe(markdown)
	})

	it("preserves underline as raw HTML in markdown", () => {
		const markdown = "This is <u>underlined</u>."

		const html = markdownToHtml(markdown)

		expect(html).toContain("<u>underlined</u>")
		expect(htmlToMarkdown(html)).toBe(markdown)
	})

	it("serializes strikethrough as GFM", () => {
		expect(htmlToMarkdown("<p>This is <s>removed</s>.</p>")).toBe(
			"This is ~~removed~~.",
		)
	})
})
