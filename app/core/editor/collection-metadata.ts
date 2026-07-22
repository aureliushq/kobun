import type { Field } from "@/config/types"

export type FieldRecord = Record<string, unknown>

export function normalizeMetadata(value: unknown): unknown {
	if (value instanceof Date) {
		const iso = value.toISOString()
		return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso
	}
	if (Array.isArray(value)) return value.map(normalizeMetadata)
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as FieldRecord).map(([key, item]) => [
				key,
				normalizeMetadata(item),
			]),
		)
	}
	return value
}

export function canonicalMetadata(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalMetadata).join(",")}]`
	if (value && typeof value === "object") {
		return `{${Object.entries(value as FieldRecord)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonicalMetadata(item)}`)
			.join(",")}}`
	}
	return JSON.stringify(value) ?? "null"
}

function defaultForField(field: Field): unknown {
	switch (field.type) {
		case "boolean":
			return field.defaultValue ?? false
		case "text":
			return field.defaultValue ?? ""
		case "select":
			return field.defaultSelected?.value ?? ""
		case "multi_select":
			return field.defaultSelected?.map(({ value }) => value) ?? []
		case "object":
			return applyMetadataDefaults(field.fields, {})
		case "array":
			return []
		default:
			return ""
	}
}

export function defaultFieldValue(field: Field): unknown {
	return defaultForField(field)
}

export function getCompositeValue(row: unknown, field: Field, index: number) {
	if (Array.isArray(row)) return row[index]
	if (row && typeof row === "object") {
		const record = row as FieldRecord
		return record[field.label] ?? record[String(index)]
	}
	return undefined
}

export function setCompositeValue(
	row: unknown,
	field: Field,
	index: number,
	value: unknown,
) {
	if (Array.isArray(row)) {
		const next = [...row]
		next[index] = value
		return next
	}
	return { ...((row as FieldRecord | null) ?? {}), [field.label]: value }
}

export function applyMetadataDefaults(
	schema: Record<string, Field>,
	values: FieldRecord,
): FieldRecord {
	const result = { ...values }
	for (const [key, field] of Object.entries(schema)) {
		if (field.type === "document") continue
		if (result[key] === undefined) result[key] = defaultForField(field)
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

function isEmpty(value: unknown) {
	return (
		value == null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	)
}

function validateField(field: Field, value: unknown, path: string): string[] {
	if (field.required && isEmpty(value)) return [`${path} is required`]
	if (isEmpty(value)) return []
	switch (field.type) {
		case "boolean":
			return typeof value === "boolean" ? [] : [`${path} must be a boolean`]
		case "multi_select": {
			if (
				!Array.isArray(value) ||
				value.some((item) => typeof item !== "string")
			)
				return [`${path} must be a list of options`]
			const options = new Set(field.options.map(({ value }) => value))
			return value.every((item) => options.has(item))
				? []
				: [`${path} contains an invalid option`]
		}
		case "select":
			return typeof value === "string" &&
				field.options.some((option) => option.value === value)
				? []
				: [`${path} is not a valid option`]
		case "url":
			try {
				new URL(String(value))
				return []
			} catch {
				return [`${path} must be a valid URL`]
			}
		case "date":
			return typeof value === "string" &&
				/^\d{4}-\d{2}-\d{2}$/.test(value) &&
				!Number.isNaN(Date.parse(value))
				? []
				: [`${path} must be a valid date`]
		case "object":
			if (!value || typeof value !== "object" || Array.isArray(value))
				return [`${path} must be an object`]
			return validateMetadata(field.fields, value as FieldRecord, path)
		case "array":
			if (!Array.isArray(value)) return [`${path} must be an array`]
			return value.flatMap((row, index) => {
				if (field.items.length === 1)
					return validateField(field.items[0], row, `${path}[${index}]`)
				if (!row || typeof row !== "object")
					return [`${path}[${index}] must be a row`]
				return field.items.flatMap((item, itemIndex) =>
					validateField(
						item,
						getCompositeValue(row, item, itemIndex),
						`${path}[${index}].${item.label}`,
					),
				)
			})
		default:
			return typeof value === "string" ? [] : [`${path} must be text`]
	}
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
