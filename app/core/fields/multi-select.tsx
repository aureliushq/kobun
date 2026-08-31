import type { MultiSelectField } from "@/config/types"
import { Badge } from "@/ui/components/base/badge"
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@/ui/components/base/combobox"
import { EmptyValue, InlineText } from "./presentation"
import { optionLabel, SELECT_PLACEHOLDER } from "./select"
import type { FieldTypeDefFor } from "./types"

/**
 * Chosen values are tokens, each with its own remove button, so one goes
 * without disturbing the rest, and the list filters as the writer types. The
 * list offers only what the schema declares: a stray value keeps its token but
 * is not on the menu, so removing it is a one-way door back to the schema.
 */
function MultiSelectControl({
	disabled,
	field,
	onChange,
	value,
}: {
	disabled?: boolean
	field: MultiSelectField
	onChange(value: unknown): void
	value: unknown
}) {
	const anchor = useComboboxAnchor()
	const chosen = Array.isArray(value) ? value.map(String) : []
	const label = (item: string) => optionLabel(field.options, item)
	return (
		<Combobox
			items={field.options.map((option) => option.value)}
			multiple
			value={chosen}
			onValueChange={(next) => onChange(next)}
			itemToStringLabel={label}
			disabled={disabled}
		>
			<ComboboxChips ref={anchor}>
				{chosen.map((item, index) => (
					// Frontmatter can repeat a value, so position is what tells two
					// tokens apart — and position is what removing one goes by.
					<ComboboxChip key={`${index}:${item}`}>{label(item)}</ComboboxChip>
				))}
				<ComboboxChipsInput
					aria-label={field.label}
					placeholder={
						chosen.length === 0
							? (field.placeholder ?? SELECT_PLACEHOLDER)
							: undefined
					}
				/>
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>No matching options.</ComboboxEmpty>
				<ComboboxList>
					{(item: string) => (
						<ComboboxItem key={item} value={item}>
							{label(item)}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
}

/**
 * Any number of choices from a declared list. Two failures worth telling apart:
 * a value that is not a list of strings at all, and a list holding something the
 * schema never offered.
 *
 * The dispatcher's dash stands for an absent value; an empty list is present
 * and holds nothing, which only this type can say, so it says it here.
 */
export const multiSelectField: FieldTypeDefFor<"multi_select"> = {
	defaultValue: ({ field }) =>
		field.defaultSelected?.map(({ value }) => value) ?? [],
	renderControl: ({ disabled, field, onChange, value }) => (
		<MultiSelectControl
			disabled={disabled}
			field={field}
			onChange={onChange}
			value={value}
		/>
	),
	renderInline: ({ field, value }) => {
		const chosen = Array.isArray(value) ? value : []
		return (
			<InlineText>
				{chosen.map((one) => optionLabel(field.options, one)).join(", ")}
			</InlineText>
		)
	},
	renderValue: ({ field, value }) => {
		const chosen = Array.isArray(value) ? value : []
		if (chosen.length === 0) return <EmptyValue />
		return (
			<div className="flex flex-wrap gap-1">
				{chosen.map((one, index) => (
					<Badge key={`${String(one)}-${index}`} variant="outline">
						{optionLabel(field.options, one)}
					</Badge>
				))}
			</div>
		)
	},
	validate: ({ field, path, value }) => {
		if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
			return [`${path} must be a list of options`]
		const options = new Set(field.options.map(({ value }) => value))
		return value.every((item) => options.has(item))
			? []
			: [`${path} contains an invalid option`]
	},
}
