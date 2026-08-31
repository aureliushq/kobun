import type z from "zod"
import { fieldSchema } from "./schema"
import type {
	AuthoredCollection,
	Collection,
	ConfigError,
	Features,
	ManagedField,
	ResolvedField,
} from "./types"

/**
 * A Field a Feature contributes to the Collections that enable it.
 *
 * `flag` is how the Feature is named back to the writer when their own Field
 * collides with this one — the config path they would edit, not a prose name.
 */
type ManagedFieldDefinition = {
	enabled: (features: Features) => boolean
	flag: string
	field: ManagedField
	key: string
}

/**
 * A Managed Field, built through the real `fieldSchema` so a definition that
 * stops being a legal Field throws on import rather than reaching a consumer.
 *
 * None of them is `required`. Publication State never backfills onto a Source
 * Kobun did not author, and a writer may clear a value the system stamped, so a
 * Managed Field is legitimately unset even after a publish (ADR-0005).
 */
const managed = (field: z.input<typeof fieldSchema>): ManagedField => ({
	...fieldSchema.parse(field),
	managed: true,
})

/**
 * Keys and labels are fixed, driven by boolean flags. That is deliberately the
 * narrow version: widening a flag from a boolean to an object later accepts
 * every config written against this one.
 *
 * `featured` contributes nothing — it is a constraint across a whole Collection
 * rather than a fact about the item being edited, so it does not fit the
 * expand-into-Fields shape (ADR-0005).
 */
const MANAGED_FIELDS: ManagedFieldDefinition[] = [
	{
		enabled: (features) => features.timestamps?.createdAt === true,
		field: managed({ label: "Created", type: "datetime" }),
		flag: "timestamps.createdAt",
		key: "createdAt",
	},
	{
		enabled: (features) => features.timestamps?.updatedAt === true,
		field: managed({ label: "Last updated", type: "datetime" }),
		flag: "timestamps.updatedAt",
		key: "updatedAt",
	},
	{
		enabled: (features) => features.publish === true,
		field: managed({ label: "Published", type: "datetime" }),
		flag: "publish",
		key: "publishedAt",
	},
	{
		enabled: (features) => features.publish === true,
		field: managed({
			// A new Collection Item reads as `draft` before it has ever been
			// published; the publish that creates it is what makes it `published`.
			defaultSelected: { label: "Draft", value: "draft" },
			label: "Status",
			options: [
				{ label: "Draft", value: "draft" },
				{ label: "Published", value: "published" },
			],
			type: "select",
		}),
		flag: "publish",
		key: "status",
	},
]

/** The definitions a feature block turns on. */
const enabledBy = (features: Features | undefined): ManagedFieldDefinition[] =>
	features ? MANAGED_FIELDS.filter(({ enabled }) => enabled(features)) : []

/**
 * The Managed Field a resolved schema holds under this key, or null when the
 * Collection enabled no Feature that contributes it.
 *
 * The marker is the whole permission: a key the Config declared itself is the
 * writer's, and a Feature colliding with one is an error rather than a silent
 * winner (ADR-0005), so nothing else needs asking.
 */
export const managedField = (
	schema: Record<string, ResolvedField>,
	key: string,
): ManagedField | null => {
	const field = schema[key]
	return field?.managed === true ? (field as ManagedField) : null
}

/** The Managed Fields a feature block contributes, keyed as they appear in the schema. */
export const managedFieldsFor = (
	features: Features | undefined,
): Record<string, ManagedField> =>
	Object.fromEntries(enabledBy(features).map(({ field, key }) => [key, field]))

/**
 * A Collection's authored schema plus the Fields its Features contribute.
 *
 * A declared Field whose key a Feature also provides is an error rather than
 * either silent resolution: letting the Field win makes the Feature quietly do
 * nothing, and letting the Feature win makes the writer's Field — its type, its
 * label, its options — quietly vanish from the editor (ADR-0005). Paths are
 * relative to the Collection; the caller scopes them to its key.
 */
export const expandFeatures = (
	collection: AuthoredCollection,
): { collection: Collection | null; errors: ConfigError[] } => {
	const errors = enabledBy(collection.features)
		.filter(({ key }) => key in collection.schema)
		.map(({ flag, key }) => ({
			code: "feature_field_collision",
			message: `Field "${key}" collides with the "${flag}" feature, which provides it. Remove the field or turn the feature off.`,
			path: `schema.${key}`,
		}))

	if (errors.length > 0) return { collection: null, errors }

	return {
		collection: {
			...collection,
			schema: {
				...collection.schema,
				...managedFieldsFor(collection.features),
			},
		},
		errors: [],
	}
}
