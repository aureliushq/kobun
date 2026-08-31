import type { Field } from "@/config/types"
import { ControlRow, renderFieldControl } from "@/core/fields"
import { defaultFieldValue } from "./collection-metadata"

/**
 * One Field in the properties sidebar: its chrome, and whatever control the
 * dispatcher decides it gets. Which control that is, and how a Container lays
 * its children out, is the registry's answer — this component knows only that
 * every Field has a name and an input.
 *
 * `defaultFieldValue` is handed down because an array needs it to build a new
 * row, and defaulting carries Role rules the registry must not learn.
 */
export function MetadataField({
	assetBaseUrl,
	disabled,
	field,
	onChange,
	value,
}: {
	assetBaseUrl?: string
	disabled?: boolean
	field: Field
	onChange(value: unknown): void
	value: unknown
}) {
	return (
		<ControlRow field={field}>
			{renderFieldControl(field, value, {
				assetBaseUrl,
				defaultForField: defaultFieldValue,
				disabled,
				onChange,
			})}
		</ControlRow>
	)
}
