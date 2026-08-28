import { arrayField } from "./array"
import { booleanField } from "./boolean"
import { dateField } from "./date"
import { imageField } from "./image"
import { multiSelectField } from "./multi-select"
import { objectField } from "./object"
import { selectField } from "./select"
import { textField } from "./text"
import type { FieldTypeDefFor, ValueFieldType } from "./types"
import { urlField } from "./url"

/**
 * One entry per Field Type, each narrowed to its own variant. Correlating the
 * key with the entry is what makes that narrowing sound — a plain
 * `Record<ValueFieldType, FieldTypeDef>` would only typecheck by leaning on
 * method bivariance.
 */
export type FieldTypeRegistry = {
	[K in ValueFieldType]: FieldTypeDefFor<K>
}

/**
 * The whole taxonomy, in one place. This is the check the refactor is for:
 * dropping an entry, adding a stray one, or declaring a tenth Field Type in the
 * config schema all fail the build here rather than falling through to an empty
 * string at runtime.
 */
export const fieldTypeRegistry = {
	array: arrayField,
	boolean: booleanField,
	date: dateField,
	image: imageField,
	multi_select: multiSelectField,
	object: objectField,
	select: selectField,
	text: textField,
	url: urlField,
} satisfies FieldTypeRegistry
