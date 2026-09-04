import { ChevronDown } from "lucide-react"
import type { PrimaryEditorAction } from "@/core/editor/primary-action"
import { Button } from "@/ui/components/base/button"
import { ButtonGroup } from "@/ui/components/base/button-group"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/ui/components/base/dropdown-menu"
import { cn } from "@/ui/lib/utils"

/**
 * The two targets in the writer's own words, at the point of choosing.
 *
 * The descriptions are not documentation moved inline. Save and Save to GitHub
 * differ in target and nothing else (ADR-0008), so a menu that only names them
 * leaves the writer to find the difference out by pressing one.
 */
const TARGETS = [
	{
		description: "Keeps your work in Kobun as a Draft. Nothing reaches GitHub.",
		label: "Save",
		value: "save",
	},
	{
		description:
			"Commits this item to the repository. It does not change whether the item is published.",
		label: "Save to GitHub",
		value: "commit",
	},
] as const satisfies readonly {
	description: string
	label: string
	value: PrimaryEditorAction
}[]

/**
 * One split control for the two targets, on GitHub's *Create pull request /
 * Create draft pull request* pattern: the primary button performs whichever the
 * writer last chose, and the menu beside it switches which one that is.
 *
 * Presentational on purpose — it holds neither the choice nor the fetcher that
 * persists it, so the layout owns both and this can be rendered without a
 * router.
 */
export function EditorSaveControl({
	disabled,
	onRun,
	onTargetChange,
	runDisabled,
	target,
}: {
	/** The editor cannot act at all: nothing loaded, or an action in flight. */
	disabled: boolean
	onRun: (target: PrimaryEditorAction) => void
	onTargetChange: (target: PrimaryEditorAction) => void
	/** This particular target has nothing to do — a Save with nothing dirty. */
	runDisabled: boolean
	target: PrimaryEditorAction
}) {
	return (
		<ButtonGroup>
			<Button
				data-testid="editor-save-primary"
				disabled={disabled || runDisabled}
				onClick={() => onRun(target)}
				type="button"
				variant="outline"
			>
				{/* Every label this button can carry, stacked in one grid cell. The
				    cell is as wide as the longest of them whichever is showing, so
				    switching the target moves nothing beside it — the same reserve-
				    the-space move as the editor's drag-handle gutter. */}
				<span className="grid">
					{TARGETS.map((option) => (
						<span
							aria-hidden={option.value !== target}
							className={cn(
								"col-start-1 row-start-1",
								option.value !== target && "invisible",
							)}
							data-testid="editor-save-label"
							key={option.value}
						>
							{option.label}
						</span>
					))}
				</span>
			</Button>
			<DropdownMenu>
				{/* Never disabled. Switching the target is a decision about the
				    writer's own chrome, and it stays available while an autosave
				    is in flight or the primary has nothing to do — otherwise the
				    menu shuts every time they type. */}
				<DropdownMenuTrigger
					render={
						<Button
							aria-label="Change what the save button does"
							size="icon"
							type="button"
							variant="outline"
						/>
					}
				>
					<ChevronDown />
				</DropdownMenuTrigger>
				{/* Wider than the chevron it is anchored to, which is what the
				    content's default `w-(--anchor-width)` would size it to. */}
				<DropdownMenuContent align="end" className="w-80">
					<DropdownMenuRadioGroup
						onValueChange={(value) =>
							onTargetChange(value as PrimaryEditorAction)
						}
						value={target}
					>
						{TARGETS.map((option) => (
							// Choosing switches the primary; it does not run it. The
							// writer picks the target, then presses the button.
							<DropdownMenuRadioItem
								closeOnClick
								key={option.value}
								value={option.value}
							>
								<span className="flex flex-col gap-0.5">
									<span className="font-medium">{option.label}</span>
									<span className="text-muted-foreground text-xs">
										{option.description}
									</span>
								</span>
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	)
}
