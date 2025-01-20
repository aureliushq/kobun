export enum FieldTypes {
	BOOLEAN = 'boolean',
	DATE = 'date',
	DOCUMENT = 'document',
	IMAGE = 'image',
	MULTISELECT = 'multiselect',
	PUBLISH = 'publish',
	SELECT = 'select',
	SLUG = 'slug',
	TEXT = 'text',
	URL = 'url',
}

type BasicField = {
	label: string
	description?: string
}

export type BooleanField = BasicField & {
	component?: 'checkbox' | 'switch'
	defaultChecked?: boolean
}
export function boolean({
	component = 'checkbox',
	defaultChecked = false,
	description,
	label,
}: BooleanField) {
	return {
		component,
		description,
		defaultChecked,
		label,
		type: FieldTypes.BOOLEAN,
	}
}

export type DateField = BasicField
export function date({ description, label }: DateField) {
	return {
		description,
		label,
		type: FieldTypes.DATE,
	}
}

export type DocumentField = BasicField
export function document({ description, label }: DocumentField) {
	return {
		description,
		label,
		type: FieldTypes.DOCUMENT,
	}
}

// export type PublishField = BooleanField
// export function publish({
// 	component = 'checkbox',
// 	defaultChecked = false,
// 	description,
// 	label,
// }: BooleanField) {
// 	return {
// 		component,
// 		description,
// 		defaultChecked,
// 		label,
// 		type: FieldTypes.PUBLISH,
// 	}
// }

type SelectOptions = {
	value: string
	label: string
}
export type SelectField = BasicField & {
	options: SelectOptions[]
	placeholder?: string
}
export function select({ description, label, options }: SelectField) {
	return {
		description,
		label,
		options,
		type: FieldTypes.SELECT,
	}
}

export type SlugField = {
	name: Omit<TextField, 'multiline' | 'type'>
	slug: Omit<TextField, 'multiline' | 'type'>
}
export function slug({ name, slug }: SlugField) {
	return {
		name,
		slug,
		type: FieldTypes.SLUG,
	}
}

export type TextField = BasicField & {
	multiline?: boolean
	placeholder?: string
	type?: HTMLInputElement['type']
}
export function text({ description, label, multiline = false }: TextField) {
	return {
		description,
		label,
		multiline,
		type: FieldTypes.TEXT,
	}
}

export type UrlField = BasicField & {
	placeholder?: string
	type?: HTMLInputElement['type']
}
export function url({ description, label }: UrlField) {
	return {
		description,
		label,
		type: FieldTypes.URL,
	}
}
