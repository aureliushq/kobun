import { getCompositeValue } from "./composite"
import type { FieldTypeDefFor } from "./types"

/**
 * Rows of items — a Container. One declared item makes each row that item's
 * value outright; several make each row a composite addressed by position or by
 * label. Children are validated through the injected callback, never by
 * reaching for the registry.
 */
export const arrayField: FieldTypeDefFor<"array"> = {
	defaultValue: () => [],
	validate: ({ field, path, validateChild, value }) => {
		if (!Array.isArray(value)) return [`${path} must be an array`]
		return value.flatMap((row, index) => {
			if (field.items.length === 1)
				return validateChild(field.items[0], row, `${path}[${index}]`)
			if (!row || typeof row !== "object")
				return [`${path}[${index}] must be a row`]
			return field.items.flatMap((item, itemIndex) =>
				validateChild(
					item,
					getCompositeValue(row, item, itemIndex),
					`${path}[${index}].${item.label}`,
				),
			)
		})
	},
}
