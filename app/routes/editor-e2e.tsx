import { useState } from "react"
import { RichTextEditor } from "@/editor"

export default function EditorE2EFixture() {
	const [markdown, setMarkdown] = useState("")

	return (
		<main className="mx-auto max-w-3xl p-8">
			<RichTextEditor
				dragHandle={false}
				imageUpload={{
					upload: async () => {
						await new Promise((resolve) => setTimeout(resolve, 100))
						return "/mock-upload.png"
					},
				}}
				onChange={setMarkdown}
			/>
			<output data-testid="markdown">{markdown}</output>
		</main>
	)
}
