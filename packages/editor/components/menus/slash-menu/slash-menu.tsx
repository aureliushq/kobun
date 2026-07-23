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
import type { SlashCommandItem } from "../../../extensions/slash-commands/extension"

interface SlashMenuProps {
	items: SlashCommandItem[]
	command: (item: SlashCommandItem) => void
	query: string
}

export interface SlashMenuRef {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
	function SlashMenu({ items, command }, ref) {
		const [selectedIndex, setSelectedIndex] = useState(0)
		const listRef = useRef<HTMLDivElement>(null)

		// Keep the latest values available to the imperative handle without
		// recreating it on every render (the suggestion plugin holds the ref).
		const stateRef = useRef({ items, selectedIndex, command })
		stateRef.current = { items, selectedIndex, command }

		// Reset the highlight to the first item whenever the filtered list
		// changes (e.g. the user types to narrow the results).
		// biome-ignore lint/correctness/useExhaustiveDependencies: reset on list change
		useEffect(() => {
			setSelectedIndex(0)
		}, [items])

		// Keep the highlighted item scrolled into view as the user navigates.
		// biome-ignore lint/correctness/useExhaustiveDependencies: re-run when selection changes
		useEffect(() => {
			const selected = listRef.current?.querySelector(
				'[data-slot="command-item"][data-selected="true"]',
			)
			selected?.scrollIntoView({ block: "nearest" })
		}, [selectedIndex])

		useImperativeHandle(
			ref,
			() => ({
				onKeyDown: ({ event }) => {
					const {
						items: currentItems,
						selectedIndex: currentIndex,
						command: runCommand,
					} = stateRef.current

					if (currentItems.length === 0) {
						return false
					}

					if (event.key === "ArrowUp") {
						setSelectedIndex(
							(currentIndex + currentItems.length - 1) % currentItems.length,
						)
						return true
					}

					if (event.key === "ArrowDown") {
						setSelectedIndex((currentIndex + 1) % currentItems.length)
						return true
					}

					if (event.key === "Enter") {
						const item = currentItems[currentIndex]
						if (item) {
							runCommand(item)
						}
						return true
					}

					return false
				},
			}),
			[],
		)

		const selectedValue = items[selectedIndex]?.title ?? ""

		return (
			<Command
				value={selectedValue}
				onValueChange={(value) => {
					const index = items.findIndex((item) => item.title === value)
					if (index >= 0) {
						setSelectedIndex(index)
					}
				}}
				shouldFilter={false}
				className="w-72 rounded-lg border shadow-md"
			>
				<CommandList ref={listRef} className="max-h-80">
					<CommandEmpty>No results</CommandEmpty>
					<CommandGroup>
						{items.map((item) => {
							const Icon = item.icon
							return (
								<CommandItem
									key={item.title}
									value={item.title}
									keywords={item.searchTerms}
									onSelect={() => command(item)}
								>
									<div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background">
										<Icon className="size-4" />
									</div>
									<div className="flex flex-col">
										<span className="font-medium">{item.title}</span>
										<span className="text-muted-foreground text-xs">
											{item.description}
										</span>
									</div>
								</CommandItem>
							)
						})}
					</CommandGroup>
				</CommandList>
			</Command>
		)
	},
)
