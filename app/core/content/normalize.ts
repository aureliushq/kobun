/**
 * Data comparison: `canonicalMetadata` answers "is this Data the same Data?"
 * independent of key order, which is what the fidelity law compares. It knows
 * nothing about a schema or a Field type — that lives in
 * `@/core/editor/collection-metadata`.
 *
 * There is deliberately no normalization step alongside it. Every Format is
 * parsed by a parser that emits only JSON-shaped values, so parsed Data needs
 * no coercion before the rest of the app transports it (see ADR-0009).
 */

type DataRecord = Record<string, unknown>

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
