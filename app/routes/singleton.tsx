import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { formatDistanceToNow } from "date-fns"
import { eq } from "drizzle-orm"
import matter from "gray-matter"
import { ChevronDown, FileText } from "lucide-react"
import { Link, redirect, useParams } from "react-router"
import invariant from "tiny-invariant"
import YAML from "yaml"
import { getAuth } from "@/auth/auth.server"
import { fetchAndParseConfig } from "@/config/github.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema/app-schema"
import { getGithubFileContent } from "@/github/octokit.server"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
} from "@/ui/components/base/accordion"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/ui/components/base/empty"
import { H2 } from "@/ui/components/base/typegraphy"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/singleton"

const MAX_RENDER_DEPTH = 5
const MAX_ACCORDION_DEPTH = 2

type SingletonField = {
	type: string
	label: string
	description?: string
	[key: string]: unknown
}

type SchemaRecord = Record<string, SingletonField>

type SelectOption = { label: string; value: string }

type RenderCtx = {
	depth: number
	accordionDepth: number
	owner: string
	name: string
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const { owner, name, singleton_slug } = params
	invariant(singleton_slug, "singleton_slug is required")

	const projects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
		with: { githubInstallation: true },
	})
	const activeProject = projects.find(
		(p) => p.repoOwnerLogin === owner && p.repoName === name,
	)
	if (!activeProject) throw redirect(PATHS.SETUP)

	const installationId = activeProject.githubInstallation.githubInstallationId

	const configResult = await fetchAndParseConfig(
		env,
		installationId,
		owner,
		name,
	)

	const config = configResult.config
	invariant(config, "config is required")

	const singleton = config.singletons[singleton_slug]
	invariant(singleton, "singleton is required")

	const filePath =
		`${config.basePath}/singletons/${singleton_slug}.${singleton.format}`.replace(
			/\/+/g,
			"/",
		)

	const editorPath = `/${owner}/${name}/singletons/${singleton_slug}/editor`

	let exists = false
	let data: Record<string, unknown> = {}
	let body: string | null = null

	try {
		const file = await getGithubFileContent(
			env,
			installationId,
			owner,
			name,
			filePath,
		)
		exists = true

		if (singleton.format === "md" || singleton.format === "mdx") {
			const parsed = matter(file.content)
			data = parsed.data as Record<string, unknown>
			body = parsed.content
		} else if (singleton.format === "json") {
			const parsed = JSON.parse(file.content)
			data =
				parsed && typeof parsed === "object" && !Array.isArray(parsed)
					? (parsed as Record<string, unknown>)
					: {}
		} else if (singleton.format === "yaml") {
			const parsed = YAML.parse(file.content)
			data =
				parsed && typeof parsed === "object" && !Array.isArray(parsed)
					? (parsed as Record<string, unknown>)
					: {}
		}
	} catch (error) {
		if (
			!(error instanceof Error && "status" in error && error.status === 404)
		) {
			throw error
		}
	}

	return {
		singleton,
		singletonSlug: singleton_slug,
		exists,
		data,
		body,
		filePath,
		editorPath,
	}
}

////////////////////// TITLE / ORDERING HELPERS //////////////////////

const TITLE_TARGETS = ["title", "name"] as const

function findObjectTitleField(
	fields: SchemaRecord,
): { key: string; field: SingletonField } | null {
	const entries = Object.entries(fields)
	// Prefer case-insensitive KEY match: title > name.
	for (const target of TITLE_TARGETS) {
		const match = entries.find(([k]) => k.toLowerCase() === target)
		if (match) return { key: match[0], field: match[1] }
	}
	// Fallback: case-insensitive LABEL match.
	for (const target of TITLE_TARGETS) {
		const match = entries.find(([, f]) => f.label.toLowerCase() === target)
		if (match) return { key: match[0], field: match[1] }
	}
	return null
}

type CompositeEntry = { key: string; index: number; field: SingletonField }

function findCompositeTitleField(
	entries: CompositeEntry[],
): { key: string; field: SingletonField } | null {
	for (const target of TITLE_TARGETS) {
		const m = entries.find((e) => e.key.toLowerCase() === target)
		if (m) return { key: m.key, field: m.field }
	}
	for (const target of TITLE_TARGETS) {
		const m = entries.find((e) => e.field.label.toLowerCase() === target)
		if (m) return { key: m.key, field: m.field }
	}
	return null
}

function orderedSchemaEntries(
	schema: SchemaRecord,
): [string, SingletonField][] {
	const entries = Object.entries(schema)

	// Determine title-ish keys (key-first, label-fallback).
	const titleKeys: string[] = []
	for (const target of TITLE_TARGETS) {
		const m = entries.find(
			([k]) => k.toLowerCase() === target && !titleKeys.includes(k),
		)
		if (m) titleKeys.push(m[0])
	}
	if (titleKeys.length === 0) {
		for (const target of TITLE_TARGETS) {
			const m = entries.find(
				([k, f]) => f.label.toLowerCase() === target && !titleKeys.includes(k),
			)
			if (m) titleKeys.push(m[0])
		}
	}

	const titles: [string, SingletonField][] = []
	const others: [string, SingletonField][] = []
	const documents: [string, SingletonField][] = []

	for (const entry of entries) {
		const [key, field] = entry
		if (field.type === "document") {
			documents.push(entry)
		} else if (titleKeys.includes(key)) {
			titles.push(entry)
		} else {
			others.push(entry)
		}
	}

	// Preserve title key priority order (title before name).
	titles.sort((a, b) => titleKeys.indexOf(a[0]) - titleKeys.indexOf(b[0]))
	return [...titles, ...others, ...documents]
}

////////////////////// ARRAY SCHEMA DESCRIPTOR //////////////////////

type ArrayRowSchema =
	| {
			kind: "object"
			itemLabel: string
			objectField: SingletonField
			entries: [string, SingletonField][]
			titleField: { key: string; field: SingletonField } | null
			getValue: (row: unknown, key: string) => unknown
	  }
	| {
			kind: "scalar"
			itemLabel: string
			field: SingletonField
			getValue: (row: unknown) => unknown
	  }
	| {
			kind: "composite"
			itemLabel: string
			entries: CompositeEntry[]
			titleField: { key: string; field: SingletonField } | null
			getValue: (row: unknown, key: string, index: number) => unknown
	  }

function singularize(s: string): string {
	return s.endsWith("s") ? s.slice(0, -1) : s
}

function capitalize(s: string): string {
	return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}

function describeArrayField(field: SingletonField): ArrayRowSchema | null {
	const items = (field.items as SingletonField[] | undefined) ?? []
	const itemLabel =
		(field.itemLabel as string | undefined) ?? singularize(field.label)
	if (items.length === 0) return null

	if (items.length === 1) {
		const sole = items[0]
		if (sole.type === "object") {
			const fields = (sole.fields as SchemaRecord | undefined) ?? {}
			return {
				kind: "object",
				itemLabel,
				objectField: sole,
				entries: Object.entries(fields),
				titleField: findObjectTitleField(fields),
				getValue: (row, key) =>
					row && typeof row === "object" && !Array.isArray(row)
						? (row as Record<string, unknown>)[key]
						: undefined,
			}
		}
		return {
			kind: "scalar",
			itemLabel,
			field: sole,
			getValue: (row) => row,
		}
	}

	const compositeEntries: CompositeEntry[] = items.map((f, i) => ({
		key: f.label,
		index: i,
		field: f,
	}))
	return {
		kind: "composite",
		itemLabel,
		entries: compositeEntries,
		titleField: findCompositeTitleField(compositeEntries),
		getValue: (row, key, index) => {
			if (Array.isArray(row)) return row[index]
			if (row && typeof row === "object")
				return (row as Record<string, unknown>)[key]
			return undefined
		},
	}
}

function resolveRowTitle(
	rowSchema: ArrayRowSchema,
	row: unknown,
): { field: SingletonField; value: unknown } | null {
	if (rowSchema.kind === "scalar") {
		return { field: rowSchema.field, value: row }
	}
	if (rowSchema.kind === "object") {
		if (!rowSchema.titleField) return null
		return {
			field: rowSchema.titleField.field,
			value: rowSchema.getValue(row, rowSchema.titleField.key),
		}
	}
	if (!rowSchema.titleField) return null
	const idx = rowSchema.entries.findIndex(
		(e) => e.key === rowSchema.titleField?.key,
	)
	return {
		field: rowSchema.titleField.field,
		value: rowSchema.getValue(row, rowSchema.titleField.key, idx),
	}
}

////////////////////// COMPONENT //////////////////////

export default function Singleton({ loaderData }: Route.ComponentProps) {
	const { singleton, exists, data, body, editorPath } = loaderData
	const params = useParams()
	const owner = params.owner ?? ""
	const name = params.name ?? ""

	const schema = singleton.schema as SchemaRecord
	const ordered = orderedSchemaEntries(schema)

	if (!exists) {
		return (
			<div className="flex flex-col gap-6 pb-8">
				<div className="flex items-center justify-between gap-4">
					<H2>{singleton.label}</H2>
				</div>
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FileText />
						</EmptyMedia>
						<EmptyTitle>No content yet</EmptyTitle>
						<EmptyDescription>
							This singleton hasn't been created yet. Create it to start editing
							its fields.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button render={<Link to={editorPath} />}>
							Create {singleton.label}
						</Button>
					</EmptyContent>
				</Empty>
			</div>
		)
	}

	type Block =
		| { kind: "fields"; entries: [string, SingletonField][] }
		| { kind: "array"; key: string; field: SingletonField }

	const blocks: Block[] = []
	for (const entry of ordered) {
		const [key, field] = entry
		if (field.type === "array") {
			blocks.push({ kind: "array", key, field })
		} else {
			const last = blocks[blocks.length - 1]
			if (last && last.kind === "fields") {
				last.entries.push(entry)
			} else {
				blocks.push({ kind: "fields", entries: [entry] })
			}
		}
	}

	const hasDocumentField = ordered.some(([, f]) => f.type === "document")
	const showFallbackBody =
		(singleton.format === "md" || singleton.format === "mdx") &&
		body != null &&
		!hasDocumentField

	const rootCtx: RenderCtx = { depth: 0, accordionDepth: 0, owner, name }

	return (
		<div className="flex flex-col gap-6 pb-8">
			<div className="flex items-center justify-between gap-4">
				<div className="flex flex-col items-start gap-2">
					<H2>{singleton.label}</H2>
					<p className="text-muted-foreground text-xs">
						<span className="font-mono">{loaderData.filePath}</span>
					</p>
				</div>
				<Button variant="outline" render={<Link to={editorPath} />}>
					Edit
				</Button>
			</div>

			{blocks.map((block) => {
				if (block.kind === "array") {
					return (
						<ArraySection
							key={`array:${block.key}`}
							fieldKey={block.key}
							field={block.field}
							value={data[block.key]}
							editorPath={editorPath}
							ctx={{ depth: 0, accordionDepth: 1, owner, name }}
						/>
					)
				}
				return (
					<dl
						key={`fields:${block.entries.map(([k]) => k).join(",")}`}
						className="flex flex-col divide-y rounded-lg border"
					>
						{block.entries.map(([key, field]) => {
							if (field.type === "document") {
								const value = body ?? (data[key] as string | undefined) ?? ""
								return (
									<FieldRow key={key} field={field}>
										<DocumentValue value={value} />
									</FieldRow>
								)
							}
							return (
								<FieldRow key={key} field={field}>
									<FieldValue field={field} value={data[key]} ctx={rootCtx} />
								</FieldRow>
							)
						})}
					</dl>
				)
			})}

			{showFallbackBody && (
				<dl className="flex flex-col divide-y rounded-lg border">
					<FieldRow
						field={{
							type: "document",
							label: "Content",
							description: "Markdown body",
						}}
					>
						<DocumentValue value={body ?? ""} />
					</FieldRow>
				</dl>
			)}
		</div>
	)
}

////////////////////// FIELD ROW / STACK //////////////////////

function FieldRow({
	field,
	children,
}: {
	field: SingletonField
	children: React.ReactNode
}) {
	return (
		<div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[200px_1fr] sm:gap-6">
			<dt className="flex flex-col gap-0.5">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					{field.label}
				</span>
				{field.description ? (
					<span className="text-muted-foreground/80 text-xs normal-case">
						{field.description}
					</span>
				) : null}
			</dt>
			<dd className="min-w-0 text-sm">{children}</dd>
		</div>
	)
}

////////////////////// FIELD VALUE (RICH PANEL) //////////////////////

function FieldValue({
	field,
	value,
	ctx,
}: {
	field: SingletonField
	value: unknown
	ctx: RenderCtx
}) {
	if (ctx.depth >= MAX_RENDER_DEPTH) {
		return <JsonFallback value={value} />
	}

	if (value == null || value === "") {
		return <span className="text-muted-foreground italic">—</span>
	}

	switch (field.type) {
		case "text":
			return <TextValue value={value} multiline={!!field.multiline} />
		case "slug":
			return (
				<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
					{String(value)}
				</code>
			)
		case "url":
			return <UrlValue value={value} />
		case "date":
			return <DateValue value={value} />
		case "boolean":
			return <BooleanValue value={value} />
		case "image":
			return <ImageValue value={value} ctx={ctx} />
		case "select":
			return (
				<SelectValueView
					value={value}
					options={(field.options as SelectOption[]) ?? []}
				/>
			)
		case "multi_select":
			return (
				<MultiSelectValue
					value={value}
					options={(field.options as SelectOption[]) ?? []}
				/>
			)
		case "array":
			if (ctx.accordionDepth >= MAX_ACCORDION_DEPTH) {
				return <JsonFallback value={value} />
			}
			return (
				<ArraySection
					field={field}
					value={value}
					ctx={{ ...ctx, accordionDepth: ctx.accordionDepth + 1 }}
				/>
			)
		case "object":
			return (
				<ObjectValueBlock
					value={value}
					fields={(field.fields as SchemaRecord) ?? {}}
					ctx={ctx}
				/>
			)
		default:
			return <JsonFallback value={value} />
	}
}

////////////////////// INLINE FIELD VALUE (TRIGGER) //////////////////////

function InlineFieldValue({
	field,
	value,
}: {
	field: SingletonField
	value: unknown
}) {
	if (value == null || value === "") {
		return <span className="text-muted-foreground italic">—</span>
	}

	switch (field.type) {
		case "text":
		case "slug":
		case "url":
			return <span className="truncate">{String(value)}</span>
		case "date": {
			const d = new Date(value as string | number | Date)
			if (Number.isNaN(d.getTime())) {
				return <span className="truncate">{String(value)}</span>
			}
			const formatted = d.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
			return <span className="truncate">{formatted}</span>
		}
		case "boolean": {
			const truthy = value === true || value === "true"
			return <span className="truncate">{truthy ? "True" : "False"}</span>
		}
		case "select": {
			const options = (field.options as SelectOption[]) ?? []
			const match = options.find((o) => o.value === String(value))
			return (
				<span className="truncate">{match ? match.label : String(value)}</span>
			)
		}
		case "multi_select": {
			const options = (field.options as SelectOption[]) ?? []
			const arr = Array.isArray(value) ? value : []
			const labels = arr.map((v) => {
				const m = options.find((o) => o.value === String(v))
				return m ? m.label : String(v)
			})
			return <span className="truncate">{labels.join(", ")}</span>
		}
		default:
			return <span className="truncate">{String(value)}</span>
	}
}

////////////////////// PRIMITIVES //////////////////////

function TextValue({
	value,
	multiline,
}: {
	value: unknown
	multiline: boolean
}) {
	const str = String(value)
	if (multiline) {
		return <p className="whitespace-pre-wrap">{str}</p>
	}
	return <span>{str}</span>
}

function UrlValue({ value }: { value: unknown }) {
	const href = String(value)
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="break-all text-primary underline-offset-4 hover:underline"
		>
			{href}
		</a>
	)
}

function DateValue({ value }: { value: unknown }) {
	const d = new Date(value as string | number | Date)
	if (Number.isNaN(d.getTime())) {
		return <span className="text-muted-foreground italic">invalid date</span>
	}
	return (
		<span title={String(value)}>
			{formatDistanceToNow(d, { addSuffix: true })}
		</span>
	)
}

function BooleanValue({ value }: { value: unknown }) {
	const truthy = value === true || value === "true"
	return (
		<Badge
			variant="outline"
			className={
				truthy
					? "border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400"
					: "border-muted-foreground/30 bg-muted text-muted-foreground"
			}
		>
			{truthy ? "true" : "false"}
		</Badge>
	)
}

function ImageValue({ value, ctx }: { value: unknown; ctx: RenderCtx }) {
	const raw = String(value)
	const isAbsolute = /^(https?:|data:)/i.test(raw)
	const src = isAbsolute ? raw : repoAssetUrl(ctx.owner, ctx.name, raw)
	return (
		<div className="flex flex-col gap-2">
			<img
				src={src}
				alt=""
				className="max-h-64 max-w-md rounded border object-contain"
			/>
			<span className="break-all font-mono text-muted-foreground text-xs">
				{raw}
			</span>
		</div>
	)
}

function repoAssetUrl(owner: string, name: string, path: string): string {
	const trimmed = path.replace(/^\/+/, "")
	const segments = trimmed.split("/").map(encodeURIComponent).join("/")
	return `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${segments}`
}

function SelectValueView({
	value,
	options,
}: {
	value: unknown
	options: SelectOption[]
}) {
	const match = options.find((o) => o.value === String(value))
	return <Badge variant="outline">{match ? match.label : String(value)}</Badge>
}

function MultiSelectValue({
	value,
	options,
}: {
	value: unknown
	options: SelectOption[]
}) {
	const arr = Array.isArray(value) ? value : []
	if (arr.length === 0) {
		return <span className="text-muted-foreground italic">—</span>
	}
	return (
		<div className="flex flex-wrap gap-1">
			{arr.map((v, i) => {
				const match = options.find((o) => o.value === String(v))
				return (
					<Badge key={`${String(v)}-${i}`} variant="outline">
						{match ? match.label : String(v)}
					</Badge>
				)
			})}
		</div>
	)
}

////////////////////// OBJECT RENDERERS //////////////////////

type ObjectBlock =
	| { kind: "fields"; entries: [string, SingletonField][] }
	| { kind: "array"; key: string; field: SingletonField }

function buildObjectBlocks(entries: [string, SingletonField][]): ObjectBlock[] {
	const blocks: ObjectBlock[] = []
	for (const entry of entries) {
		const [key, field] = entry
		if (field.type === "array") {
			blocks.push({ kind: "array", key, field })
		} else {
			const last = blocks[blocks.length - 1]
			if (last && last.kind === "fields") {
				last.entries.push(entry)
			} else {
				blocks.push({ kind: "fields", entries: [entry] })
			}
		}
	}
	return blocks
}

function ObjectFieldsList({
	entries,
	value,
	ctx,
}: {
	entries: [string, SingletonField][]
	value: unknown
	ctx: RenderCtx
}) {
	if (ctx.depth >= MAX_RENDER_DEPTH) {
		return <JsonFallback value={value} />
	}
	if (entries.length === 0) {
		return <JsonFallback value={value} />
	}
	const obj =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {}
	const childCtx: RenderCtx = { ...ctx, depth: ctx.depth + 1 }
	const blocks = buildObjectBlocks(entries)

	return (
		<div className="flex flex-col gap-4">
			{blocks.map((block) => {
				if (block.kind === "array") {
					return (
						<FieldValue
							key={`array:${block.key}`}
							field={block.field}
							value={obj[block.key]}
							ctx={childCtx}
						/>
					)
				}
				return (
					<dl
						key={`fields:${block.entries.map(([k]) => k).join(",")}`}
						className="flex flex-col divide-y rounded-lg border"
					>
						{block.entries.map(([key, field]) => (
							<FieldRow key={key} field={field}>
								<FieldValue field={field} value={obj[key]} ctx={childCtx} />
							</FieldRow>
						))}
					</dl>
				)
			})}
		</div>
	)
}

function ObjectValueBlock({
	value,
	fields,
	ctx,
}: {
	value: unknown
	fields: SchemaRecord
	ctx: RenderCtx
}) {
	const entries = Object.entries(fields)
	if (entries.length === 0) {
		return <JsonFallback value={value} />
	}
	return <ObjectFieldsList entries={entries} value={value} ctx={ctx} />
}

////////////////////// ARRAY RENDERERS //////////////////////

function ArraySection({
	fieldKey,
	field,
	value,
	editorPath,
	ctx,
}: {
	fieldKey?: string
	field: SingletonField
	value: unknown
	editorPath?: string
	ctx: RenderCtx
}) {
	const items = Array.isArray(value) ? value : []
	const rowSchema = describeArrayField(field)
	if (rowSchema == null) {
		return <JsonFallback value={value} />
	}

	const isLevel1 = ctx.accordionDepth === 1

	if (isLevel1) {
		const addLink =
			editorPath && fieldKey ? `${editorPath}/${fieldKey}/new` : null
		return (
			<Card className="gap-0 overflow-hidden py-0">
				<CardHeader className="border-b py-3">
					<CardTitle>{field.label}</CardTitle>
					{addLink ? (
						<CardAction>
							<Button size="sm" render={<Link to={addLink} />}>
								Add {capitalize(rowSchema.itemLabel)}
							</Button>
						</CardAction>
					) : null}
				</CardHeader>
				<CardContent className="p-0">
					{items.length === 0 ? (
						<div className="m-4 rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
							No items.
						</div>
					) : (
						<Accordion
							defaultValue={[]}
							className="w-full rounded-none border-0"
						>
							{items.map((item, i) => (
								<ArrayItemAccordion
									key={`${i}-${stableKey(item)}`}
									fieldKey={fieldKey}
									rowSchema={rowSchema}
									item={item}
									index={i}
									editorPath={editorPath}
									ctx={ctx}
								/>
							))}
						</Accordion>
					)}
				</CardContent>
			</Card>
		)
	}

	// Level 2 — plain section.
	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<h5 className="font-medium text-sm">{field.label}</h5>
				<Badge variant="outline" className="text-xs">
					{items.length} {items.length === 1 ? "item" : "items"}
				</Badge>
			</div>
			{items.length === 0 ? (
				<div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-xs">
					No items.
				</div>
			) : (
				<Accordion
					defaultValue={[]}
					className="w-full rounded-md border bg-background"
				>
					{items.map((item, i) => (
						<ArrayItemAccordion
							key={`${i}-${stableKey(item)}`}
							rowSchema={rowSchema}
							item={item}
							index={i}
							ctx={ctx}
						/>
					))}
				</Accordion>
			)}
		</section>
	)
}

function ArrayItemAccordion({
	fieldKey,
	rowSchema,
	item,
	index,
	editorPath,
	ctx,
}: {
	fieldKey?: string
	rowSchema: ArrayRowSchema
	item: unknown
	index: number
	editorPath?: string
	ctx: RenderCtx
}) {
	const title = resolveRowTitle(rowSchema, item)
	const fallbackTitle = `${rowSchema.itemLabel} ${index + 1}`
	const showEdit = !!editorPath && !!fieldKey && ctx.accordionDepth === 1
	const itemEditorPath = showEdit
		? `${editorPath}/${fieldKey}/${index + 1}`
		: null
	const isLevel1 = ctx.accordionDepth === 1
	const triggerClass = isLevel1
		? "group/trigger flex flex-1 items-center gap-3 border border-transparent p-3 text-left text-sm outline-none transition-all hover:underline"
		: "group/trigger flex flex-1 items-center gap-3 border border-transparent p-2 text-left text-xs outline-none transition-all hover:underline"

	return (
		<AccordionItem value={`item-${index}`}>
			<AccordionPrimitive.Header className="flex items-center gap-1 pr-2">
				<AccordionPrimitive.Trigger
					data-slot="accordion-trigger"
					className={triggerClass}
				>
					<ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open/trigger:rotate-180" />
					<div className="min-w-0 flex-1 truncate">
						<ItemTitle title={title} fallback={fallbackTitle} />
					</div>
					<span className="shrink-0 text-muted-foreground text-xs">
						#{index + 1}
					</span>
				</AccordionPrimitive.Trigger>
				{itemEditorPath ? (
					<Button
						variant="outline"
						size="sm"
						render={<Link to={itemEditorPath} />}
					>
						Edit
					</Button>
				) : null}
			</AccordionPrimitive.Header>
			<AccordionContent>
				<ArrayItemPanel rowSchema={rowSchema} item={item} ctx={ctx} />
			</AccordionContent>
		</AccordionItem>
	)
}

function ItemTitle({
	title,
	fallback,
}: {
	title: { field: SingletonField; value: unknown } | null
	fallback: string
}) {
	if (!title || title.value == null || title.value === "") {
		return <span>{fallback}</span>
	}
	return <InlineFieldValue field={title.field} value={title.value} />
}

function ArrayItemPanel({
	rowSchema,
	item,
	ctx,
}: {
	rowSchema: ArrayRowSchema
	item: unknown
	ctx: RenderCtx
}) {
	// Children of the panel render at the same accordionDepth; depth bumps
	// when descending into object fields (handled by ObjectFieldsList).
	const childCtx: RenderCtx = { ...ctx, depth: ctx.depth + 1 }

	if (rowSchema.kind === "scalar") {
		return (
			<div className="pt-2">
				<dl className="flex flex-col divide-y rounded-lg border">
					<FieldRow field={rowSchema.field}>
						<FieldValue field={rowSchema.field} value={item} ctx={childCtx} />
					</FieldRow>
				</dl>
			</div>
		)
	}

	if (rowSchema.kind === "object") {
		return (
			<div className="pt-2">
				<ObjectFieldsList entries={rowSchema.entries} value={item} ctx={ctx} />
			</div>
		)
	}

	// Composite — group consecutive non-array entries into a bordered FieldRow
	// list; arrays render as separate sections (mirrors ObjectFieldsList).
	type CompositeBlock =
		| { kind: "fields"; entries: CompositeEntry[] }
		| { kind: "array"; entry: CompositeEntry }
	const blocks: CompositeBlock[] = []
	for (const e of rowSchema.entries) {
		if (e.field.type === "array") {
			blocks.push({ kind: "array", entry: e })
		} else {
			const last = blocks[blocks.length - 1]
			if (last && last.kind === "fields") {
				last.entries.push(e)
			} else {
				blocks.push({ kind: "fields", entries: [e] })
			}
		}
	}

	return (
		<div className="flex flex-col gap-4 pt-2">
			{blocks.map((block) => {
				if (block.kind === "array") {
					return (
						<FieldValue
							key={`array:${block.entry.key}-${block.entry.index}`}
							field={block.entry.field}
							value={rowSchema.getValue(
								item,
								block.entry.key,
								block.entry.index,
							)}
							ctx={childCtx}
						/>
					)
				}
				return (
					<dl
						key={`fields:${block.entries.map((e) => `${e.key}-${e.index}`).join(",")}`}
						className="flex flex-col divide-y rounded-lg border"
					>
						{block.entries.map((e) => (
							<FieldRow key={`${e.key}-${e.index}`} field={e.field}>
								<FieldValue
									field={e.field}
									value={rowSchema.getValue(item, e.key, e.index)}
									ctx={childCtx}
								/>
							</FieldRow>
						))}
					</dl>
				)
			})}
		</div>
	)
}

////////////////////// MISC //////////////////////

function DocumentValue({ value }: { value: string }) {
	if (!value.trim()) {
		return <span className="text-muted-foreground italic">empty</span>
	}
	return (
		<pre className="overflow-auto rounded border bg-muted/30 p-3 font-mono text-xs">
			{value}
		</pre>
	)
}

function stableKey(value: unknown): string {
	if (value == null) return "null"
	if (typeof value === "string" || typeof value === "number")
		return String(value).slice(0, 32)
	try {
		return JSON.stringify(value).slice(0, 32)
	} catch {
		return "obj"
	}
}

function JsonFallback({ value }: { value: unknown }) {
	return (
		<pre className="overflow-auto rounded border bg-muted/30 p-3 font-mono text-xs">
			{JSON.stringify(value, null, 2)}
		</pre>
	)
}
