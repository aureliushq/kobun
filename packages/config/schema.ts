import z from "zod"

////////////////////// FIELDS //////////////////////
enum BooleanComponentType {
	CHECKBOX = "checkbox",
	SWITCH = "switch",
}

enum FieldType {
	ARRAY = "array",
	BOOLEAN = "boolean",
	DATE = "date",
	DOCUMENT = "document",
	IMAGE = "image",
	MULTI_SELECT = "multi_select",
	OBJECT = "object",
	SELECT = "select",
	SLUG = "slug",
	TEXT = "text",
	URL = "url",
}

const selectOptionSchema = z.object({
	label: z.string(),
	value: z.string(),
})
type SelectOption = z.infer<typeof selectOptionSchema>

type BaseField = {
	description?: string
	label: string
	required?: boolean
}

type IField =
	| (BaseField & {
			itemLabel?: string
			items: IField
			type: FieldType.ARRAY
	  })
	| (BaseField & {
			componentType?: BooleanComponentType
			defaultValue?: boolean
			type: FieldType.BOOLEAN
	  })
	| (BaseField & {
			type: FieldType.DATE
	  })
	| (BaseField & {
			type: FieldType.DOCUMENT
	  })
	| (BaseField & {
			type: FieldType.IMAGE
	  })
	| (BaseField & {
			defaultSelected?: SelectOption[]
			options: SelectOption[]
			placeholder?: string
			type: FieldType.MULTI_SELECT
	  })
	| (BaseField & {
			fields: Record<string, IField>
			type: FieldType.OBJECT
	  })
	| (BaseField & {
			defaultSelected?: SelectOption
			options: SelectOption[]
			placeholder?: string
			type: FieldType.SELECT
	  })
	| (BaseField & {
			from: string
			placeholder?: string
			type: FieldType.SLUG
	  })
	| (BaseField & {
			defaultValue?: string
			multiline?: boolean
			placeholder?: string
			type: FieldType.TEXT
	  })
	| (BaseField & {
			placeholder?: string
			type: FieldType.URL
	  })

const baseFieldSchema = z.object({
	description: z.string().optional(),
	label: z.string(),
	required: z.boolean().optional(),
})

export const booleanFieldSchema = baseFieldSchema.extend({
	componentType: z
		.enum([BooleanComponentType.CHECKBOX, BooleanComponentType.SWITCH])
		.optional(),
	defaultValue: z.boolean().optional(),
	type: z.literal(FieldType.BOOLEAN),
})

export const dateFieldSchema = baseFieldSchema.extend({
	type: z.literal(FieldType.DATE),
})

export const documentFieldSchema = baseFieldSchema.extend({
	type: z.literal(FieldType.DOCUMENT),
})

export const imageFieldSchema = baseFieldSchema.extend({
	type: z.literal(FieldType.IMAGE),
})

export const multiSelectFieldSchema = baseFieldSchema.extend({
	defaultSelected: z.array(selectOptionSchema).optional(),
	options: z.array(selectOptionSchema),
	placeholder: z.string().optional(),
	type: z.literal(FieldType.MULTI_SELECT),
})

export const selectFieldSchema = baseFieldSchema.extend({
	defaultSelected: selectOptionSchema.optional(),
	options: z.array(selectOptionSchema),
	placeholder: z.string().optional(),
	type: z.literal(FieldType.SELECT),
})

export const slugFieldSchema = baseFieldSchema.extend({
	from: z.string(),
	type: z.literal(FieldType.SLUG),
})

export const textFieldSchema = baseFieldSchema.extend({
	defaultValue: z.string().optional(),
	multiline: z.boolean().optional(),
	placeholder: z.string().optional(),
	type: z.literal(FieldType.TEXT),
})

export const urlFieldSchema = baseFieldSchema.extend({
	placeholder: z.string().optional(),
	type: z.literal(FieldType.URL),
})

export const fieldSchema: z.ZodType<IField> = z.lazy(() =>
	z.discriminatedUnion("type", [
		arrayFieldSchema,
		booleanFieldSchema,
		dateFieldSchema,
		documentFieldSchema,
		imageFieldSchema,
		multiSelectFieldSchema,
		objectFieldSchema,
		selectFieldSchema,
		slugFieldSchema,
		textFieldSchema,
		urlFieldSchema,
	]),
)

export const arrayFieldSchema = baseFieldSchema.extend({
	itemLabel: z.string().optional(),
	items: fieldSchema,
	type: z.literal(FieldType.ARRAY),
})

export const objectFieldSchema = baseFieldSchema.extend({
	fields: z.record(z.string(), fieldSchema),
	type: z.literal(FieldType.OBJECT),
})

////////////////////// FEATURES //////////////////////
export const featureSchema = z.object({
	featured: z.object({ limit: z.number() }).optional(),
	publish: z.boolean().optional(),
	timestamps: z.object({
		createdAt: z.string().optional(),
		updatedAt: z.string().optional(),
	}),
})

////////////////////// COLLECTIONS & SINGLETONS //////////////////////
enum Format {
	JSON = "json",
	MD = "md",
	MDX = "mdx",
	YAML = "yaml",
}

function validateContentSchema(
	data: { format: string; schema: Record<string, IField> },
	ctx: z.RefinementCtx,
	requireSlug: boolean,
) {
	const fields = Object.entries(data.schema)
	const fieldMap = new Map(fields)

	const hasDocument = fields.some(([, f]) => f.type === FieldType.DOCUMENT)
	if (hasDocument && data.format !== Format.MD && data.format !== Format.MDX) {
		ctx.addIssue({
			code: "custom",
			message: `Format must be "md" or "mdx" when a "document" field is present`,
			path: ["format"],
		})
	}

	const slugFields = fields.filter(([, f]) => f.type === FieldType.SLUG)
	if (requireSlug) {
		if (slugFields.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: `Schema must have exactly one "slug" field`,
				path: ["schema"],
			})
		} else if (slugFields.length > 1) {
			ctx.addIssue({
				code: "custom",
				message: `Schema must have exactly one "slug" field, found ${slugFields.length}`,
				path: ["schema"],
			})
		}
	}

	for (const [name, field] of slugFields) {
		if (field.type !== FieldType.SLUG) continue
		if (!fieldMap.has(field.from)) {
			ctx.addIssue({
				code: "custom",
				message: `slug.from "${field.from}" does not reference a field in the schema`,
				path: ["schema", name, "from"],
			})
		} else if (
			field.from &&
			fieldMap.get(field.from)?.type !== FieldType.TEXT
		) {
			ctx.addIssue({
				code: "custom",
				message: `slug.from "${field.from}" must reference a "text" field, found "${fieldMap.get(field.from)?.type}"`,
				path: ["schema", name, "from"],
			})
		}
	}

	for (const [name, field] of fields) {
		if (
			field.type === FieldType.SELECT &&
			field.defaultSelected &&
			field.options
		) {
			const optionValues = field.options.map((o) => o.value)
			if (!optionValues.includes(field.defaultSelected.value)) {
				ctx.addIssue({
					code: "custom",
					message: `defaultSelected value "${field.defaultSelected.value}" is not a valid option`,
					path: ["schema", name, "defaultSelected"],
				})
			}
		}
		if (
			field.type === FieldType.MULTI_SELECT &&
			field.defaultSelected &&
			field.options
		) {
			const optionValues = field.options.map((o) => o.value)
			for (let i = 0; i < field.defaultSelected.length; i++) {
				if (!optionValues.includes(field.defaultSelected[i].value)) {
					ctx.addIssue({
						code: "custom",
						message: `defaultSelected value "${field.defaultSelected[i].value}" is not a valid option`,
						path: ["schema", name, "defaultSelected", i],
					})
				}
			}
		}
	}
}

export const collectionSchema = z
	.object({
		features: featureSchema.optional(),
		format: z.enum([Format.JSON, Format.MD, Format.MDX, Format.YAML]),
		label: z.string(),
		schema: z.record(z.string(), fieldSchema),
	})
	.superRefine((data, ctx) => validateContentSchema(data, ctx, true))

export const singletonSchema = z
	.object({
		features: featureSchema.optional(),
		format: z.enum([Format.JSON, Format.MD, Format.MDX, Format.YAML]),
		label: z.string(),
		schema: z.record(z.string(), fieldSchema),
	})
	.superRefine((data, ctx) => validateContentSchema(data, ctx, false))

export const versionSchema = z.int()

////////////////////// CONFIGURATION //////////////////////
export const kobunConfigSchema = z.object({
	basePath: z.string().optional(),
	collections: z.record(z.string(), collectionSchema),
	singletons: z.record(z.string(), singletonSchema),
	version: versionSchema,
})
