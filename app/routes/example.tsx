import { useState } from "react"
import { useSearchParams } from "react-router"
import { RichTextEditor } from "@/editor"
import ComponentExample from "@/ui/components/component-example"

export default function Example() {
	const [searchParams] = useSearchParams()
	if (searchParams.has("editor-e2e")) return <EditorE2EFixture />
	return <ComponentExample />
}

function EditorE2EFixture() {
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
