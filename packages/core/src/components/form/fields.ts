import {
	FieldTypes,
	type MultiSelectField,
	type ArrayField,
	type BooleanField,
	type DateField,
	type DocumentField,
	type ObjectField,
	type SelectField,
	type SlugField,
	type TextField,
	type UrlField,
	type ConfigSchema,
	type SchemaKey,
	type Field,
} from '@kobun/common'

export const fields = {
	array: (
		field: Field,
		config: Omit<ArrayField, 'type' | 'field'>,
	): ArrayField => ({
		...config,
		field,
		type: FieldTypes.ARRAY,
	}),

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

	object: (
		schema: ConfigSchema<SchemaKey>,
		config: Omit<ObjectField, 'type' | 'schema'>,
	): ObjectField => ({
		...config,
		schema,
		type: FieldTypes.OBJECT,
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
