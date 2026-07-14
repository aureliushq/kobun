import {
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
} from "@tiptap/react"
import { Check, Copy, TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/ui/components/base/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/ui/components/base/select"

const AUTO_LANGUAGE = "__auto__"

type CopyStatus = "idle" | "copied" | "error"

export function CodeBlockNodeView({
	editor,
	extension,
	node,
	updateAttributes,
}: ReactNodeViewProps) {
	const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle")
	const resetCopyStatusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const language = (node.attrs.language as string | null) ?? null
	const languages = useMemo(() => {
		const registeredLanguages = (
			extension.options.lowlight.listLanguages() as string[]
		).sort((left, right) => left.localeCompare(right))

		if (language && !registeredLanguages.includes(language)) {
			return [language, ...registeredLanguages]
		}

		return registeredLanguages
	}, [extension.options.lowlight, language])

	useEffect(() => {
		return () => clearTimeout(resetCopyStatusTimer.current)
	}, [])

	const copyCode = async () => {
		clearTimeout(resetCopyStatusTimer.current)

		try {
			await navigator.clipboard.writeText(node.textContent)
			setCopyStatus("copied")
		} catch {
			setCopyStatus("error")
		}

		resetCopyStatusTimer.current = setTimeout(() => {
			setCopyStatus("idle")
		}, 2000)
	}

	return (
		<NodeViewWrapper className="code-block-node-view">
			<div className="code-block-toolbar" contentEditable={false}>
				<Select
					disabled={!editor.isEditable}
					value={language ?? AUTO_LANGUAGE}
					onValueChange={(value) => {
						if (!value) return
						updateAttributes({
							language: value === AUTO_LANGUAGE ? null : value,
						})
					}}
				>
					<SelectTrigger
						aria-label="Code block language"
						className="code-block-language"
						size="sm"
					>
						<SelectValue>
							{(value) => (value === AUTO_LANGUAGE ? "Auto" : String(value))}
						</SelectValue>
					</SelectTrigger>
					<SelectContent align="start">
						<SelectItem value={AUTO_LANGUAGE}>Auto</SelectItem>
						{languages.map((languageName) => (
							<SelectItem key={languageName} value={languageName}>
								{languageName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					aria-label={copyStatus === "copied" ? "Code copied" : "Copy code"}
					onClick={copyCode}
					size="icon-sm"
					title={copyStatus === "error" ? "Unable to copy code" : undefined}
					type="button"
					variant="ghost"
				>
					{copyStatus === "copied" && <Check />}
					{copyStatus === "error" && <TriangleAlert />}
					{copyStatus === "idle" && <Copy />}
				</Button>
				<span aria-live="polite" className="sr-only">
					{copyStatus === "copied" && "Code copied to clipboard"}
					{copyStatus === "error" && "Unable to copy code"}
				</span>
			</div>
			<pre>
				<NodeViewContent<"code"> as="code" />
			</pre>
		</NodeViewWrapper>
	)
}
