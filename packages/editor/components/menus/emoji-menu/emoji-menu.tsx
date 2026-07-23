import type { EmojiItem } from "@tiptap/extension-emoji"
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/ui/components/base/command"

interface EmojiMenuProps {
	command: (item: EmojiItem) => void
	items: EmojiItem[]
}

export interface EmojiMenuRef {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const EmojiMenu = forwardRef<EmojiMenuRef, EmojiMenuProps>(
	function EmojiMenu({ items, command }, ref) {
		const [selectedIndex, setSelectedIndex] = useState(0)
		const listRef = useRef<HTMLDivElement>(null)
		const stateRef = useRef({ items, selectedIndex, command })
		stateRef.current = { items, selectedIndex, command }

		// biome-ignore lint/correctness/useExhaustiveDependencies: reset on list change
		useEffect(() => setSelectedIndex(0), [items])

		// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on selection change
		useEffect(() => {
			listRef.current
				?.querySelector('[data-slot="command-item"][data-selected="true"]')
				?.scrollIntoView({ block: "nearest" })
		}, [selectedIndex])

		useImperativeHandle(
			ref,
			() => ({
				onKeyDown: ({ event }) => {
					const current = stateRef.current
					if (current.items.length === 0) return false

					if (event.key === "ArrowUp") {
						setSelectedIndex(
							(current.selectedIndex + current.items.length - 1) %
								current.items.length,
						)
						return true
					}

					if (event.key === "ArrowDown") {
						setSelectedIndex((current.selectedIndex + 1) % current.items.length)
						return true
					}

					if (event.key === "Enter") {
						const item = current.items[current.selectedIndex]
						if (item) current.command(item)
						return true
					}

					return false
				},
			}),
			[],
		)

		return (
			<Command
				value={items[selectedIndex]?.name ?? ""}
				onValueChange={(value) => {
					const index = items.findIndex((item) => item.name === value)
					if (index >= 0) setSelectedIndex(index)
				}}
				shouldFilter={false}
				className="w-72 rounded-lg border shadow-md"
			>
				<CommandList ref={listRef} className="max-h-80">
					<CommandEmpty>No emoji found</CommandEmpty>
					<CommandGroup>
						{items.map((item) => (
							<CommandItem
								key={item.name}
								onSelect={() => command(item)}
								value={item.name}
							>
								<span className="text-lg">{item.emoji}</span>
								<span>:{item.shortcodes[0] ?? item.name}:</span>
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</Command>
		)
	},
)
