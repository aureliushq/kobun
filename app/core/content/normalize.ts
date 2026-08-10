/**
 * Data normalization and comparison — the two schema-free operations the
 * Content Document needs. `normalizeMetadata` puts parsed Data into the one
 * shape the rest of the app transports (notably, YAML `Date` objects become
 * `yyyy-mm-dd` strings); `canonicalMetadata` answers "is this Data the same
 * Data?" independent of key order, which is what the fidelity law compares.
 *
 * Neither knows anything about a schema or a Field type — that lives in
 * `@/core/editor/collection-metadata`.
 */

type DataRecord = Record<string, unknown>

export function normalizeMetadata(value: unknown): unknown {
	if (value instanceof Date) {
		const iso = value.toISOString()
		return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso
	}
	if (Array.isArray(value)) return value.map(normalizeMetadata)
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as DataRecord).map(([key, item]) => [
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
		return `{${Object.entries(value as DataRecord)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonicalMetadata(item)}`)
			.join(",")}}`
	}
	return JSON.stringify(value) ?? "null"
}
