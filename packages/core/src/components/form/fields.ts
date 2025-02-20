import {
	type DateField,
	type DocumentField,
	type SelectField,
	type SlugField,
	type TextField,
	type UrlField,
	type BooleanField,
	FieldTypes,
} from '@rescribe/common'

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

export function date({ description, label }: DateField) {
	return {
		description,
		label,
		type: FieldTypes.DATE,
	}
}

export function document({ description, label }: DocumentField) {
	return {
		description,
		label,
		type: FieldTypes.DOCUMENT,
	}
}

export function select({ description, label, options }: SelectField) {
	return {
		description,
		label,
		options,
		type: FieldTypes.SELECT,
	}
}

export function slug({ description, label, title }: SlugField) {
	return {
		description,
		label,
		title,
		type: FieldTypes.SLUG,
	}
}

export function text({
	description,
	label,
	multiline = false,
	type,
}: TextField) {
	return {
		description,
		label,
		fieldType: type,
		multiline,
		type: FieldTypes.TEXT,
	}
}

export function url({ description, label }: UrlField) {
	return {
		description,
		label,
		type: FieldTypes.URL,
	}
}
