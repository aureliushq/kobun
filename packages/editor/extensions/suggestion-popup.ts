import { shift } from "@floating-ui/dom"
import { ReactRenderer } from "@tiptap/react"
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion"
import type { ForwardRefExoticComponent, RefAttributes } from "react"

export type SuggestionMenuRef = {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

// Suggestion positions the popup with floating-ui (offset + flip) through
// `props.mount`; shift keeps it inside the viewport near the edges.
export function suggestionPopup<I>(
	Menu: ForwardRefExoticComponent<
		{
			items: I[]
			command: (item: I) => void
		} & RefAttributes<SuggestionMenuRef>
	>,
): Pick<SuggestionOptions<I>, "floatingUi" | "render"> {
	return {
		floatingUi: { middleware: [shift({ padding: 8 })] },
		render: () => {
			let component: ReactRenderer<SuggestionMenuRef> | null = null
			let unmount: (() => void) | null = null

			const menuProps = ({ items, command }: SuggestionProps<I>) => ({
				items,
				command,
			})

			return {
				onStart: (props) => {
					component = new ReactRenderer(Menu, {
						props: menuProps(props),
						editor: props.editor,
						className: "z-50",
					})
					unmount = props.mount(component.element)
				},
				onUpdate: (props) => component?.updateProps(menuProps(props)),
				// The editor keeps DOM focus, so the menu never receives keys
				// directly. Forward them so it can drive selection and insertion.
				onKeyDown: (props) => component?.ref?.onKeyDown(props) ?? false,
				onExit: () => {
					unmount?.()
					component?.destroy()
					unmount = null
					component = null
				},
			}
		},
	}
}
