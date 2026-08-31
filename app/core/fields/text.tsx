import { Textarea } from "@/ui/components/base/textarea"
import { InlineText, TextControl } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/** A line or block of prose. The Scalar every other text-shaped type falls back on. */
export const textField: FieldTypeDefFor<"text"> = {
	defaultValue: ({ field }) => field.defaultValue ?? "",
	// A multiline Field needs somewhere to put the lines; everything else fits
	// on one, and says so by not offering the room.
	renderControl: ({ disabled, field, onChange, value }) =>
		field.multiline ? (
			<Textarea
				value={String(value ?? "")}
				placeholder={field.placeholder}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
			/>
		) : (
			<TextControl
				disabled={disabled}
				onChange={onChange}
				placeholder={field.placeholder}
				value={value}
			/>
		),
	renderInline: ({ value }) => <InlineText>{String(value)}</InlineText>,
	renderValue: ({ field, value }) =>
		// Only a multiline Field keeps its line breaks: a single-line value that
		// somehow holds one should not push the row open.
		field.multiline ? (
			<p className="whitespace-pre-wrap">{String(value)}</p>
		) : (
			<span>{String(value)}</span>
		),
	validate: ({ path, value }) =>
		typeof value === "string" ? [] : [`${path} must be text`],
}
