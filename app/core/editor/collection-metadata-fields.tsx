import type { Field } from "@/config/types"
import { renderFieldControl } from "@/core/fields"
import { ControlRow } from "@/core/fields/presentation"
import { defaultFieldValue, updateMetadataField } from "./collection-metadata"

/**
 * One Field in the properties sidebar: its chrome, and whatever control the
 * dispatcher decides it gets. Which control that is, and how a Container lays
 * its children out, is the registry's answer — this component knows only that
 * every Field has a name and an input.
 *
 * `defaultFieldValue` is handed down because an array needs it to build a new
 * row, and `updateMetadataField` because an object needs it to derive a Slug
 * among its children. Both carry Role rules the registry must not learn.
 */
export function MetadataField({
	assetBaseUrl,
	disabled,
	editorPath,
	field,
	fieldKey,
	onChange,
	value,
}: {
	assetBaseUrl?: string
	disabled?: boolean
	/** The Singleton editor this Field's array rows open their own editors under. */
	editorPath?: string
	field: Field
	fieldKey?: string
	onChange(value: unknown): void
	value: unknown
}) {
	return (
		<ControlRow field={field}>
			{renderFieldControl(field, value, {
				assetBaseUrl,
				defaultForField: defaultFieldValue,
				disabled,
				editorPath,
				fieldKey,
				onChange,
				updateForSchema: updateMetadataField,
			})}
		</ControlRow>
	)
}
