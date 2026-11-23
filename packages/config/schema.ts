import z from "zod"
import type { Field } from "./types"

////////////////////// FIELDS //////////////////////
export const selectOptionSchema = z.object({
	label: z.string(),
	value: z.string(),
})

const baseFieldSchema = z.object({
	description: z.string().optional(),
	label: z.string(),
	required: z.boolean().optional(),
})

export const arrayFieldSchema = baseFieldSchema.extend({
	itemLabel: z.string().optional(),
	get items() {
		return z.array(fieldSchema)
	},
	type: z.literal("array"),
})

const booleanFieldSchema = baseFieldSchema.extend({
	componentType: z.enum(["checkbox", "switch"]).optional(),
	defaultValue: z.boolean().optional(),
	type: z.literal("boolean"),
})

const dateFieldSchema = baseFieldSchema.extend({
	type: z.literal("date"),
})

const datetimeFieldSchema = baseFieldSchema.extend({
	type: z.literal("datetime"),
})

export const documentFieldSchema = baseFieldSchema.extend({
	type: z.literal("document"),
})

const imageFieldSchema = baseFieldSchema.extend({
	type: z.literal("image"),
})

export const multiSelectFieldSchema = baseFieldSchema.extend({
	defaultSelected: z.array(selectOptionSchema).optional(),
	options: z.array(selectOptionSchema),
	placeholder: z.string().optional(),
	type: z.literal("multi_select"),
})

const objectFieldSchema = baseFieldSchema.extend({
	get fields() {
		return z.record(z.string(), fieldSchema)
	},
	type: z.literal("object"),
})

export const selectFieldSchema = baseFieldSchema.extend({
	defaultSelected: selectOptionSchema.optional(),
	options: z.array(selectOptionSchema),
	placeholder: z.string().optional(),
	type: z.literal("select"),
})

export const slugFieldSchema = baseFieldSchema.extend({
	from: z.string(),
	placeholder: z.string().optional(),
	type: z.literal("slug"),
})

const textFieldSchema = baseFieldSchema.extend({
	defaultValue: z.string().optional(),
	multiline: z.boolean().optional(),
	placeholder: z.string().optional(),
	type: z.literal("text"),
})

const urlFieldSchema = baseFieldSchema.extend({
	placeholder: z.string().optional(),
	type: z.literal("url"),
})

export const fieldSchema = z.discriminatedUnion("type", [
	arrayFieldSchema,
	booleanFieldSchema,
	dateFieldSchema,
	datetimeFieldSchema,
	documentFieldSchema,
	imageFieldSchema,
	multiSelectFieldSchema,
	objectFieldSchema,
	selectFieldSchema,
	slugFieldSchema,
	textFieldSchema,
	urlFieldSchema,
])

////////////////////// FEATURES //////////////////////
export const featureSchema = z.object({
	featured: z.object({ limit: z.number() }).optional(),
	publish: z.boolean().optional(),
	timestamps: z
		.object({
			createdAt: z.boolean().optional(),
			updatedAt: z.boolean().optional(),
		})
		.optional(),
})

////////////////////// COLLECTIONS & SINGLETONS //////////////////////
// A Slug derives from a text Field in its own schema, whether that is the
// item's or a nested object's.
function validateSlugSources(
	fields: Record<string, Field>,
	path: (string | number)[],
	ctx: z.RefinementCtx,
) {
	const fieldMap = new Map(Object.entries(fields))
	for (const [name, field] of fieldMap) {
		if (field.type !== "slug") continue
		const source = fieldMap.get(field.from)
		if (!source) {
			ctx.addIssue({
				code: "custom",
				message: `slug.from "${field.from}" does not reference a field in the schema`,
				path: [...path, name, "from"],
			})
		} else if (source.type !== "text") {
			ctx.addIssue({
				code: "custom",
				message: `slug.from "${field.from}" must reference a "text" field, found "${source.type}"`,
				path: [...path, name, "from"],
			})
		}
	}
}

// The item has one Body, so a nested Document is refused until the editor can
// place one (#154). A nested Slug is checked against the object it sits in; an
// array item has no Field beside it to derive from.
function validateNestedFields(
	field: Field,
	path: (string | number)[],
	ctx: z.RefinementCtx,
) {
	if (field.type === "object") {
		validateSlugSources(field.fields, [...path, "fields"], ctx)
		for (const [key, child] of Object.entries(field.fields)) {
			validateNestedChild(child, [...path, "fields", key], ctx)
		}
	} else if (field.type === "array") {
		field.items.forEach((child, i) => {
			if (child.type === "slug") {
				ctx.addIssue({
					code: "custom",
					message: `A "slug" field cannot be an array item: it has no "text" field beside it to derive from`,
					path: [...path, "items", i],
				})
			}
			validateNestedChild(child, [...path, "items", i], ctx)
		})
	}
}

function validateNestedChild(
	child: Field,
	path: (string | number)[],
	ctx: z.RefinementCtx,
) {
	if (child.type === "document") {
		ctx.addIssue({
			code: "custom",
			message: `A "document" field must be at the top level of the schema`,
			path,
		})
	}
	validateNestedFields(child, path, ctx)
}

function validateContentSchema(
	data: { format: string; schema: Record<string, Field> },
	ctx: z.RefinementCtx,
	requireSlug: boolean,
) {
	const fields = Object.entries(data.schema)

	const documentCount = fields.filter(([, f]) => f.type === "document").length
	if (documentCount > 0 && data.format !== "md" && data.format !== "mdx") {
		ctx.addIssue({
			code: "custom",
			message: `Format must be "md" or "mdx" when a "document" field is present`,
			path: ["format"],
		})
	}
	if (documentCount > 1) {
		ctx.addIssue({
			code: "custom",
			message: `Schema can have at most one "document" field`,
			path: ["schema"],
		})
	}

	const slugFields = fields.filter(([, f]) => f.type === "slug")
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

	validateSlugSources(data.schema, ["schema"], ctx)

	for (const [name, field] of fields) {
		validateNestedFields(field, ["schema", name], ctx)
		if (field.type === "select" && field.defaultSelected) {
			const optionValues = field.options.map((o) => o.value)
			if (!optionValues.includes(field.defaultSelected.value)) {
				ctx.addIssue({
					code: "custom",
					message: `defaultSelected value "${field.defaultSelected.value}" is not a valid option`,
					path: ["schema", name, "defaultSelected"],
				})
			}
		}
		if (field.type === "multi_select" && field.defaultSelected) {
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

const contentShape = {
	features: featureSchema.optional(),
	format: z.enum(["json", "md", "mdx", "yaml"]),
	label: z.string(),
	schema: z.record(z.string(), fieldSchema),
}

// Subcollections go one level deep, and only Collections have them. The key is
// refused rather than left to `z.object`, which would drop it with nothing said.
export const subcollectionSchema = z
	.object({
		...contentShape,
		subcollections: z
			.never({ error: "A Subcollection cannot declare Subcollections" })
			.optional(),
	})
	.superRefine((data, ctx) => validateContentSchema(data, ctx, true))

export const collectionSchema = z
	.object({
		...contentShape,
		subcollections: z.record(z.string(), subcollectionSchema).optional(),
	})
	.superRefine((data, ctx) => validateContentSchema(data, ctx, true))

export const singletonSchema = z
	.object({
		...contentShape,
		subcollections: z
			.never({ error: "Only Collections have Subcollections" })
			.optional(),
	})
	.superRefine((data, ctx) => validateContentSchema(data, ctx, false))

export const versionSchema = z.int()

////////////////////// CONFIGURATION //////////////////////
export const kobunConfigSchema = z.object({
	basePath: z.string().optional(),
	collections: z.record(z.string(), collectionSchema),
	mediaPath: z.string().optional(),
	mediaUrl: z.string().optional(),
	singletons: z.record(z.string(), singletonSchema).optional(),
	version: versionSchema,
})
