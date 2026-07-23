import type { ArrayField, Field } from "@/config/types"
import { Button } from "@/ui/components/base/button"
import { Checkbox } from "@/ui/components/base/checkbox"
import { Input } from "@/ui/components/base/input"
import { Switch } from "@/ui/components/base/switch"
import { Textarea } from "@/ui/components/base/textarea"
import {
	defaultFieldValue,
	type FieldRecord,
	getCompositeValue,
	setCompositeValue,
} from "./collection-metadata"

function emptyArrayItem(field: ArrayField) {
	if (field.items.length === 1) {
		return defaultFieldValue(field.items[0])
	}
	return field.items.map(defaultFieldValue)
}

function Control({
	field,
	value,
	onChange,
	disabled,
	assetBaseUrl,
}: {
	field: Field
	value: unknown
	onChange(value: unknown): void
	disabled?: boolean
	assetBaseUrl?: string
}) {
	if (field.type === "object") {
		const record =
			value && typeof value === "object" && !Array.isArray(value)
				? (value as FieldRecord)
				: {}
		return (
			<div className="space-y-3 rounded-md border p-3">
				{Object.entries(field.fields).map(([key, child]) => (
					<MetadataField
						key={key}
						field={child}
						value={record[key]}
						onChange={(next) => onChange({ ...record, [key]: next })}
						disabled={disabled}
						assetBaseUrl={assetBaseUrl}
					/>
				))}
			</div>
		)
	}
	if (field.type === "array") {
		const rows = Array.isArray(value) ? value : []
		return (
			<div className="space-y-2">
				{rows.map((row, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: array values have no stable identity in frontmatter
					<div className="space-y-2 rounded-md border p-3" key={index}>
						{field.items.length === 1 ? (
							<MetadataField
								field={field.items[0]}
								value={row}
								onChange={(next) =>
									onChange(rows.map((item, i) => (i === index ? next : item)))
								}
								disabled={disabled}
								assetBaseUrl={assetBaseUrl}
							/>
						) : (
							field.items.map((item, itemIndex) => (
								<MetadataField
									key={`${item.type}:${item.label}`}
									field={item}
									value={getCompositeValue(row, item, itemIndex)}
									onChange={(next) =>
										onChange(
											rows.map((current, i) =>
												i === index
													? setCompositeValue(current, item, itemIndex, next)
													: current,
											),
										)
									}
									disabled={disabled}
									assetBaseUrl={assetBaseUrl}
								/>
							))
						)}
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={disabled || index === 0}
								onClick={() => {
									const next = [...rows]
									;[next[index - 1], next[index]] = [
										next[index],
										next[index - 1],
									]
									onChange(next)
								}}
							>
								Up
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={disabled || index === rows.length - 1}
								onClick={() => {
									const next = [...rows]
									;[next[index + 1], next[index]] = [
										next[index],
										next[index + 1],
									]
									onChange(next)
								}}
							>
								Down
							</Button>
							<Button
								type="button"
								variant="destructive"
								disabled={disabled}
								onClick={() => onChange(rows.filter((_, i) => i !== index))}
							>
								Remove
							</Button>
						</div>
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					onClick={() => onChange([...rows, emptyArrayItem(field)])}
				>
					Add {field.itemLabel ?? "item"}
				</Button>
			</div>
		)
	}
	if (field.type === "boolean")
		return field.componentType === "switch" ? (
			<Switch
				checked={value === true}
				disabled={disabled}
				onCheckedChange={onChange}
			/>
		) : (
			<Checkbox
				checked={value === true}
				disabled={disabled}
				onCheckedChange={(checked) => onChange(checked === true)}
			/>
		)
	if (field.type === "select" || field.type === "multi_select") {
		return (
			<select
				className="min-h-7 w-full rounded-md border bg-background px-2 text-sm"
				multiple={field.type === "multi_select"}
				disabled={disabled}
				value={
					field.type === "multi_select"
						? Array.isArray(value)
							? value.map(String)
							: []
						: String(value ?? "")
				}
				onChange={(event) =>
					onChange(
						field.type === "multi_select"
							? Array.from(
									event.currentTarget.selectedOptions,
									({ value }) => value,
								)
							: event.currentTarget.value,
					)
				}
			>
				<option value="">{field.placeholder ?? "Select…"}</option>
				{field.options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		)
	}
	const input =
		field.type === "text" && field.multiline ? (
			<Textarea
				value={String(value ?? "")}
				placeholder={field.placeholder}
				disabled={disabled}
				onChange={(event) => onChange(event.target.value)}
			/>
		) : (
			<Input
				type={
					field.type === "date" ? "date" : field.type === "url" ? "url" : "text"
				}
				value={String(value ?? "")}
				disabled={disabled}
				placeholder={"placeholder" in field ? field.placeholder : undefined}
				onChange={(event) => onChange(event.target.value)}
			/>
		)
	return (
		<>
			{input}
			{field.type === "image" && value ? (
				<img
					className="mt-2 max-h-40 rounded-md border object-contain"
					src={resolveImageSource(String(value), assetBaseUrl)}
					alt="Preview"
				/>
			) : null}
		</>
	)
}

function resolveImageSource(value: string, assetBaseUrl?: string) {
	if (/^(https?:|data:|\/)/i.test(value) || !assetBaseUrl) return value
	return `${assetBaseUrl}/${value
		.replace(/^\/+/, "")
		.split("/")
		.map(encodeURIComponent)
		.join("/")}`
}

export function MetadataField({
	field,
	value,
	onChange,
	disabled,
	assetBaseUrl,
}: {
	field: Field
	value: unknown
	onChange(value: unknown): void
	disabled?: boolean
	assetBaseUrl?: string
}) {
	return (
		<div className="space-y-1.5">
			<p className="font-medium text-sm">
				{field.label}
				{field.required ? " *" : ""}
			</p>
			{field.description ? (
				<p className="text-muted-foreground text-xs">{field.description}</p>
			) : null}
			<Control
				field={field}
				value={value}
				onChange={onChange}
				disabled={disabled}
				assetBaseUrl={assetBaseUrl}
			/>
		</div>
	)
}
