import type { Field } from "@/config/types"

/**
 * The chrome every rendered Field shares: the label/description row it sits in,
 * the dash that stands for nothing filled in, and the last-resort JSON dump.
 *
 * Its own module rather than part of the dispatcher because the entries need it
 * too — and an entry importing the dispatcher would close the loop the registry
 * exists to keep open.
 */

/** One labelled row: the Field's name and description beside its value. */
export function FieldRow({
	field,
	children,
}: {
	field: Pick<Field, "description" | "label">
	children: React.ReactNode
}) {
	return (
		<div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[200px_1fr] sm:gap-6">
			<dt className="flex flex-col gap-0.5">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					{field.label}
				</span>
				{field.description ? (
					<span className="text-muted-foreground/80 text-xs normal-case">
						{field.description}
					</span>
				) : null}
			</dt>
			<dd className="min-w-0 text-sm">{children}</dd>
		</div>
	)
}

/** Nothing filled in. */
export function EmptyValue() {
	return <span className="text-muted-foreground italic">—</span>
}

/**
 * What a value looks like when no render can be trusted with it — past the
 * nesting limits, or a schema too malformed to describe.
 */
export function JsonFallback({ value }: { value: unknown }) {
	return (
		<pre className="overflow-auto rounded border bg-muted/30 p-3 font-mono text-xs">
			{JSON.stringify(value, null, 2)}
		</pre>
	)
}

/**
 * A React key for an array row. Rows carry no identity of their own, so this
 * pairs with the index rather than replacing it: it keeps a row's element from
 * being reused for a different row's content when rows are reordered.
 */
export function stableKey(value: unknown): string {
	if (value == null) return "null"
	if (typeof value === "string" || typeof value === "number")
		return String(value).slice(0, 32)
	try {
		return JSON.stringify(value).slice(0, 32)
	} catch {
		return "obj"
	}
}

export function singularize(s: string): string {
	return s.endsWith("s") ? s.slice(0, -1) : s
}

export function capitalize(s: string): string {
	return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}
