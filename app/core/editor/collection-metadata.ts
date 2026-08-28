import type { Field } from "@/config/types"
import {
	type DefaultForSchema,
	defaultForField,
	validateField,
} from "@/core/fields"

export {
	getCompositeValue,
	setCompositeValue,
} from "@/core/fields/composite"

export type FieldRecord = Record<string, unknown>

/**
 * How the registry's Container entries default their children. It is supplied
 * from here rather than derived in the registry because defaulting a schema
 * carries Role rules — a Document key is omitted entirely, a Slug is derived
 * from its source Field — and Roles are this module's business, not a Field
 * Type's.
 */
const defaultForSchema: DefaultForSchema = (schema) =>
	applyMetadataDefaults(schema, {})

export function defaultFieldValue(field: Field): unknown {
	return defaultForField(field, defaultForSchema)
}

export function applyMetadataDefaults(
	schema: Record<string, Field>,
	values: FieldRecord,
): FieldRecord {
	const result = { ...values }
	for (const [key, field] of Object.entries(schema)) {
		if (field.type === "document") continue
		if (result[key] === undefined)
			result[key] = defaultForField(field, defaultForSchema)
	}
	for (const [key, field] of Object.entries(schema)) {
		if (field.type !== "slug" || String(result[key] ?? "").trim()) continue
		result[key] = slugify(String(result[field.from] ?? ""))
	}
	return result
}

export function slugify(value: string) {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

export function updateMetadataField(
	schema: Record<string, Field>,
	current: FieldRecord,
	key: string,
	value: unknown,
) {
	const next = { ...current, [key]: value }
	const slugEntry = Object.entries(schema).find(
		([, field]) => field.type === "slug",
	)
	if (!slugEntry || slugEntry[1].type !== "slug" || slugEntry[1].from !== key) {
		return next
	}
	const [slugKey] = slugEntry
	const currentSlug = String(current[slugKey] ?? "")
	const previousDerivedSlug = slugify(String(current[key] ?? ""))
	if (!currentSlug || currentSlug === previousDerivedSlug) {
		next[slugKey] = slugify(String(value ?? ""))
	}
	return next
}

export function validateMetadata(
	schema: Record<string, Field>,
	values: FieldRecord,
	prefix = "",
): string[] {
	return Object.entries(schema).flatMap(([key, field]) =>
		field.type === "document" && !prefix
			? []
			: validateField(
					field,
					values[key],
					prefix ? `${prefix}.${field.label}` : field.label,
				),
	)
}

export function getSlugField(schema: Record<string, Field>) {
	return (
		Object.entries(schema).find(([, field]) => field.type === "slug")?.[0] ??
		null
	)
}

export function getCollectionEditorFields(schema: Record<string, Field>) {
	const entries = Object.entries(schema)
	const slugField = entries.find(([, field]) => field.type === "slug")
	const titleKey = slugField?.[1].type === "slug" ? slugField[1].from : null
	const documentKey =
		entries.find(([, field]) => field.type === "document")?.[0] ?? null
	return {
		documentKey,
		sidebarFields: entries.filter(
			([key]) => key !== titleKey && key !== documentKey,
		),
		titleKey,
	}
}
