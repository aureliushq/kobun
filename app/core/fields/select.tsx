import { Badge } from "@/ui/components/base/badge"
import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * What a stored value is called. A value the list no longer offers is shown
 * as-is rather than hidden: the file says it, so the page says it too.
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
 * The list a writer picks from. `multi_select` is this control with the plural
 * turned on, down to the empty option: single choice needs it to clear itself,
 * and multiple choice keeps it so both read the same.
 */
export function OptionsControl({
	disabled,
	multiple,
	onChange,
	options,
	placeholder,
	value,
}: {
	disabled?: boolean
	multiple: boolean
	onChange(value: unknown): void
	options: { label: string; value: string }[]
	placeholder?: string
	value: unknown
}) {
	return (
		<select
			className="min-h-7 w-full rounded-md border bg-background px-2 text-sm"
			multiple={multiple}
			disabled={disabled}
			value={
				multiple
					? Array.isArray(value)
						? value.map(String)
						: []
					: String(value ?? "")
			}
			onChange={(event) =>
				onChange(
					multiple
						? Array.from(
								event.currentTarget.selectedOptions,
								({ value }) => value,
							)
						: event.currentTarget.value,
				)
			}
		>
			<option value="">{placeholder ?? "Select…"}</option>
			{options.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	)
}

/** One choice from a declared list. Empty is a value the list need not offer. */
export const selectField: FieldTypeDefFor<"select"> = {
	defaultValue: ({ field }) => field.defaultSelected?.value ?? "",
	renderControl: ({ disabled, field, onChange, value }) => (
		<OptionsControl
			disabled={disabled}
			multiple={false}
			onChange={onChange}
			options={field.options}
			placeholder={field.placeholder}
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
