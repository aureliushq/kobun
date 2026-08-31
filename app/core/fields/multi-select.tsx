import { Badge } from "@/ui/components/base/badge"
import { EmptyValue, InlineText } from "./presentation"
import { OptionsControl, optionLabel } from "./select"
import type { FieldTypeDefFor } from "./types"

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
		<OptionsControl
			disabled={disabled}
			multiple
			onChange={onChange}
			options={field.options}
			placeholder={field.placeholder}
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
