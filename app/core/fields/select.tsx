import type { SelectField, SelectOption } from "@/config/types"
import { Badge } from "@/ui/components/base/badge"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/ui/components/base/select"
import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/** What the placeholder says when the schema does not say it itself. */
export const SELECT_PLACEHOLDER = "Select…"

/**
 * What a stored value is called. A value the list no longer offers is shown
 * as-is rather than hidden: the file says it, so the page says it too — the
 * writer sees what is there before deciding to drop it, and an untouched field
 * saves it back unchanged.
 *
 * Exported for `multi_select`, which is this type in the plural and asks the
 * same question of every choice.
 */
export function optionLabel(
	options: { label: string; value: string }[],
	value: unknown,
): string {
	const match = options.find((option) => option.value === String(value))
	return match ? match.label : String(value)
}

/**
 * `null` is "nothing chosen"; anything else is a value the writer picked. A
 * stored `""` is nothing chosen — unless the schema declares an option whose
 * value is `""`, in which case the empty string is a real choice and stays one.
 */
function chosenValue(options: SelectOption[], value: unknown) {
	if (value == null) return null
	const chosen = String(value)
	if (chosen === "" && !options.some((option) => option.value === "")) {
		return null
	}
	return chosen
}

function SelectControl({
	disabled,
	field,
	onChange,
	value,
}: {
	disabled?: boolean
	field: SelectField
	onChange(value: unknown): void
	value: unknown
}) {
	const placeholder = field.placeholder ?? SELECT_PLACEHOLDER
	// The `null` entry is both the "nothing chosen" label and the way back to
	// it, the way the native control's empty `<option>` used to be. Listing it
	// among the items is what lets the control resolve the label itself — by
	// option for a declared value, by the raw string for a stray one.
	const items = [{ label: placeholder, value: null }, ...field.options]
	return (
		<Select
			items={items}
			value={chosenValue(field.options, value)}
			onValueChange={(next) => onChange(next ?? "")}
			disabled={disabled}
		>
			<SelectTrigger aria-label={field.label} className="w-full">
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectItem value={null}>
						<span className="text-muted-foreground">{placeholder}</span>
					</SelectItem>
					{field.options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	)
}

/** One choice from a declared list. Empty is a value the list need not offer. */
export const selectField: FieldTypeDefFor<"select"> = {
	defaultValue: ({ field }) => field.defaultSelected?.value ?? "",
	renderControl: ({ disabled, field, onChange, value }) => (
		<SelectControl
			disabled={disabled}
			field={field}
			onChange={onChange}
			value={value}
		/>
	),
	renderInline: ({ field, value }) => (
		<InlineText>{optionLabel(field.options, value)}</InlineText>
	),
	renderValue: ({ field, value }) => (
		<Badge variant="outline">{optionLabel(field.options, value)}</Badge>
	),
	validate: ({ field, path, value }) =>
		typeof value === "string" &&
		field.options.some((option) => option.value === value)
			? []
			: [`${path} is not a valid option`],
}
