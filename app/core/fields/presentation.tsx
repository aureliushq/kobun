import { Fragment } from "react"
import type { Field } from "@/config/types"
import type { RenderChild } from "./types"

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

/** A value summarized on one line, clipped rather than wrapped. */
export function InlineText({ children }: { children: React.ReactNode }) {
	return <span className="truncate">{children}</span>
}

export type FieldBlock =
	| { kind: "fields"; entries: [string, Field][] }
	| { kind: "array"; key: string; field: Field }

/**
 * Consecutive Fields share one bordered list; an array breaks the run, because
 * an array brings a card or a section of its own and cannot sit in a row.
 */
export function buildFieldBlocks(entries: [string, Field][]): FieldBlock[] {
	const blocks: FieldBlock[] = []
	for (const entry of entries) {
		const [key, field] = entry
		if (field.type === "array") {
			blocks.push({ kind: "array", key, field })
		} else {
			const last = blocks[blocks.length - 1]
			if (last && last.kind === "fields") {
				last.entries.push(entry)
			} else {
				blocks.push({ kind: "fields", entries: [entry] })
			}
		}
	}
	return blocks
}

/**
 * A record of values laid out against a record of Fields. Both Containers reach
 * for it: an `object` renders its own fields this way, and so does an `array`
 * whose sole item is an object.
 *
 * A schema declaring no fields is not a layout — there is nothing to lay the
 * value against — so the value is dumped instead.
 */
export function FieldsPanel({
	entries,
	renderChild,
	value,
}: {
	entries: [string, Field][]
	renderChild: RenderChild
	value: unknown
}) {
	if (entries.length === 0) {
		return <JsonFallback value={value} />
	}
	const record =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {}

	return (
		<div className="flex flex-col gap-4">
			{buildFieldBlocks(entries).map((block) => {
				if (block.kind === "array") {
					return (
						<Fragment key={`array:${block.key}`}>
							{renderChild(block.field, record[block.key])}
						</Fragment>
					)
				}
				return (
					<dl
						key={`fields:${block.entries.map(([k]) => k).join(",")}`}
						className="flex flex-col divide-y rounded-lg border"
					>
						{block.entries.map(([key, field]) => (
							<FieldRow key={key} field={field}>
								{renderChild(field, record[key])}
							</FieldRow>
						))}
					</dl>
				)
			})}
		</div>
	)
}
