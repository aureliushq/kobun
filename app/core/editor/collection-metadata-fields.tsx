import { format, isValid } from "date-fns"
import type {
	ArrayField,
	Field,
	MultiSelectField,
	SelectField,
	SelectOption,
} from "@/config/types"
import { Button } from "@/ui/components/base/button"
import { Checkbox } from "@/ui/components/base/checkbox"
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@/ui/components/base/combobox"
import { Input } from "@/ui/components/base/input"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/ui/components/base/select"
import { Switch } from "@/ui/components/base/switch"
import { Textarea } from "@/ui/components/base/textarea"
import {
	defaultFieldValue,
	type FieldRecord,
	getCompositeValue,
	setCompositeValue,
} from "./collection-metadata"

type ControlProps<F extends Field = Field> = {
	field: F
	value: unknown
	onChange(value: unknown): void
	disabled?: boolean
	assetBaseUrl?: string
}

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
}: ControlProps) {
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
	if (field.type === "select") {
		return (
			<SelectControl
				field={field}
				value={value}
				onChange={onChange}
				disabled={disabled}
			/>
		)
	}
	if (field.type === "multi_select") {
		return (
			<MultiSelectControl
				field={field}
				value={value}
				onChange={onChange}
				disabled={disabled}
			/>
		)
	}
	if (field.type === "datetime") {
		return (
			<Input
				type="datetime-local"
				step="1"
				value={toDatetimeLocal(value)}
				disabled={disabled}
				onChange={(event) => onChange(fromDatetimeLocal(event.target.value))}
			/>
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

const SELECT_PLACEHOLDER = "Select…"

/**
 * What the writer reads for a stored value. A value the schema no longer
 * declares has no label to show, so it shows as itself rather than vanishing —
 * the writer can see what is there before deciding to drop it, and an untouched
 * field saves it back unchanged.
 */
function labelFor(options: SelectOption[], value: string) {
	return options.find((option) => option.value === value)?.label ?? value
}

/**
 * `null` is "nothing chosen"; anything else is a value the writer picked. A
 * stored `""` is nothing chosen — unless the schema declares an option whose
 * value is `""`, in which case the empty string is a real choice and stays one.
 */
function chosenValue(options: SelectOption[], value: unknown) {
	if (value == null) return null
	const chosen = String(value)
	if (chosen === "" && !options.some((option) => option.value === "")) {
		return null
	}
	return chosen
}

function SelectControl({
	field,
	value,
	onChange,
	disabled,
}: ControlProps<SelectField>) {
	const placeholder = field.placeholder ?? SELECT_PLACEHOLDER
	// The `null` entry is both the "nothing chosen" label and the way back to
	// it, the way the native control's empty `<option>` used to be. Listing it
	// among the items is what lets the control resolve the label itself — by
	// option for a declared value, by the raw string for a stray one.
	const items = [{ label: placeholder, value: null }, ...field.options]
	return (
		<Select
			items={items}
			value={chosenValue(field.options, value)}
			onValueChange={(next) => onChange(next ?? "")}
			disabled={disabled}
		>
			<SelectTrigger aria-label={field.label} className="w-full">
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectItem value={null}>
						<span className="text-muted-foreground">{placeholder}</span>
					</SelectItem>
					{field.options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	)
}

/**
 * Chosen values are tokens, each with its own remove button, so one goes
 * without disturbing the rest. The list offers only what the schema declares:
 * a stray value keeps its token but is not on the menu, so removing it is a
 * one-way door back to the schema.
 */
function MultiSelectControl({
	field,
	value,
	onChange,
	disabled,
}: ControlProps<MultiSelectField>) {
	const anchor = useComboboxAnchor()
	const chosen = Array.isArray(value) ? value.map(String) : []
	const label = (item: string) => labelFor(field.options, item)
	return (
		<Combobox
			items={field.options.map((option) => option.value)}
			multiple
			value={chosen}
			onValueChange={(next) => onChange(next)}
			itemToStringLabel={label}
			disabled={disabled}
		>
			<ComboboxChips ref={anchor}>
				{chosen.map((item, index) => (
					// Frontmatter can repeat a value, so position is what tells two
					// tokens apart — and position is what removing one goes by.
					<ComboboxChip key={`${index}:${item}`}>{label(item)}</ComboboxChip>
				))}
				<ComboboxChipsInput
					aria-label={field.label}
					placeholder={
						chosen.length === 0
							? (field.placeholder ?? SELECT_PLACEHOLDER)
							: undefined
					}
				/>
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>No matching options.</ComboboxEmpty>
				<ComboboxList>
					{(item: string) => (
						<ComboboxItem key={item} value={item}>
							{label(item)}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
}

/**
 * A datetime is stored as a UTC instant but edited in the writer's local wall
 * time, which is the only thing `datetime-local` can speak. An unparseable
 * value shows an empty picker rather than an invented one.
 *
 * Seconds are carried (with `step="1"` on the control) so that editing a
 * stamped value does not silently round it down to the minute.
 */
function toDatetimeLocal(value: unknown) {
	const date = new Date(String(value ?? ""))
	return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : ""
}

function fromDatetimeLocal(local: string) {
	if (!local) return ""
	const date = new Date(local)
	// A browser without `datetime-local` degrades the control to a text input,
	// so junk is reachable. Hand it back rather than blanking what was typed —
	// the validator names the problem, an empty field would hide it.
	return isValid(date) ? date.toISOString() : local
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
}: ControlProps) {
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
