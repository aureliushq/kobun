import { Fragment } from "react"
import { FieldsPanel, InlineText } from "./presentation"
import { resolveTitle } from "./roles"
import type { FieldTypeDefFor } from "./types"

/**
 * Named sub-fields — a Container. Its default comes from the injected schema
 * callback rather than from mapping its children here, because defaulting a
 * schema carries Role rules (nested Documents omitted, nested Slugs derived)
 * that no Field Type entry is allowed to know.
 *
 * Validation takes no such callback, deliberately: nested Fields carry no Role
 * rules at all. The metadata module skips a Document only at the top level, and
 * it decided that before this entry was reached — so a Document nested here
 * reaches the dispatcher and is refused, loudly. The config layer does not yet
 * forbid one (its cross-field rules only walk the top level), which is why the
 * refusal is the thing that says so.
 *
 * Rendering recurses the same way: through the callbacks the dispatcher hands
 * over, never by reaching for the registry.
 */
export const objectField: FieldTypeDefFor<"object"> = {
	defaultValue: ({ defaultForSchema, field }) => defaultForSchema(field.fields),
	// Each child edited in place, in a box that says they belong together. A
	// child hands back its own value; assembling the record around it is this
	// entry's job, because only it knows which key the child answers to.
	renderControl: ({ field, onChange, renderChild, value }) => {
		const record = asRecord(value)
		return (
			<div className="space-y-3 rounded-md border p-3">
				{Object.entries(field.fields).map(([key, child]) => (
					<Fragment key={key}>
						{renderChild(child, record[key], (next) =>
							onChange({ ...record, [key]: next }),
						)}
					</Fragment>
				))}
			</div>
		)
	},
	// One line has room for one thing, so it goes to whichever child heads the
	// object; failing that, the shape of what is there.
	renderInline: ({ field, renderChildInline, value }) => {
		const entries = Object.entries(field.fields)
		const title = resolveTitle(entries)
		const record = asRecord(value)
		const heading = title ? record[title.key] : undefined
		if (title && heading != null && heading !== "")
			return renderChildInline(title.field, heading)
		return (
			<InlineText>
				{entries.length} {entries.length === 1 ? "field" : "fields"}
			</InlineText>
		)
	},
	renderValue: ({ field, renderChild, value }) => (
		<FieldsPanel
			entries={Object.entries(field.fields)}
			renderChild={renderChild}
			value={value}
		/>
	),
	validate: ({ field, path, validateChild, value }) => {
		if (!value || typeof value !== "object" || Array.isArray(value))
			return [`${path} must be an object`]
		const record = value as Record<string, unknown>
		return Object.entries(field.fields).flatMap(([key, child]) =>
			validateChild(child, record[key], `${path}.${child.label}`),
		)
	},
}

/** Anything that is not a record of children holds none of them. */
function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}
