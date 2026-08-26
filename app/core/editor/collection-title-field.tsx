import { useCallback } from "react"

import { Textarea } from "@/ui/components/base/textarea"

interface CollectionTitleFieldProps {
	disabled?: boolean
	onChange: (value: string) => void
	onCommit: () => void
	placeholder?: string
	value: string
}

/**
 * The collection item's display heading.
 *
 * A textarea rather than an input so a long title wraps and grows instead of
 * scrolling sideways. The value stays single-line regardless: newlines are
 * collapsed on the way in, because this field derives the item's slug.
 */
export function CollectionTitleField({
	disabled,
	onChange,
	onCommit,
	placeholder,
	value,
}: CollectionTitleFieldProps) {
	const focusOnMount = useCallback((node: HTMLTextAreaElement | null) => {
		if (!node) return
		node.focus()
		const end = node.value.length
		node.setSelectionRange(end, end)
	}, [])

	return (
		<Textarea
			aria-label="Title"
			// `md:text-4xl` is load-bearing: the base textarea carries
			// `md:text-xs/relaxed`, which otherwise wins above 768px.
			className="field-sizing-content min-h-0 w-full max-w-[42rem] resize-none overflow-hidden rounded-none border-0 bg-transparent px-0 py-2 font-semibold text-4xl leading-tight focus-visible:ring-0 md:text-4xl dark:bg-transparent"
			disabled={disabled}
			onChange={(event) =>
				onChange(event.target.value.replace(/[\r\n]+/g, " "))
			}
			onKeyDown={(event) => {
				if (event.key !== "Enter") return
				event.preventDefault()
				onCommit()
			}}
			placeholder={placeholder}
			ref={focusOnMount}
			rows={1}
			value={value}
		/>
	)
}
