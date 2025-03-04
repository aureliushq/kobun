import {
	FieldTypes,
	type MultiSelectField,
	type BooleanField,
	type DateField,
	type DocumentField,
	type SelectField,
	type SlugField,
	type TextField,
	type UrlField,
} from '@kobun/common'

export const fields = {
	boolean: (config: Omit<BooleanField, 'type'>): BooleanField => ({
		...config,
		type: FieldTypes.BOOLEAN,
	}),

	date: (config: Omit<DateField, 'type'>): DateField => ({
		...config,
		type: FieldTypes.DATE,
	}),

	document: (config: Omit<DocumentField, 'type'>): DocumentField => ({
		...config,
		type: FieldTypes.DOCUMENT,
	}),

	// image: (config: Omit<ImageField, "type">): ImageField => ({
	//   ...config,
	//   type: FieldTypes.IMAGE,
	// }),

	multiselect: (
		config: Omit<MultiSelectField, 'type'>,
	): MultiSelectField => ({
		...config,
		type: FieldTypes.MULTISELECT,
	}),

	select: (config: Omit<SelectField, 'type'>): SelectField => ({
		...config,
		type: FieldTypes.SELECT,
	}),

	slug: (config: Omit<SlugField, 'type'>): SlugField => ({
		...config,
		type: FieldTypes.SLUG,
	}),

	text: (config: Omit<TextField, 'type'>): TextField => ({
		...config,
		type: FieldTypes.TEXT,
	}),

	url: (config: Omit<UrlField, 'type'>): UrlField => ({
		...config,
		type: FieldTypes.URL,
	}),
}
