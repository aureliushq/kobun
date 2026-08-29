import { FileText } from "lucide-react"
import { Fragment } from "react"
import { Link, useParams } from "react-router"
import type { Field } from "@/config/types"
import { parseDocument } from "@/core/content/document.server"
import { type RenderContext, renderFieldValue } from "@/core/fields"
import { buildFieldBlocks, FieldRow } from "@/core/fields/presentation"
import { requireSingleton } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { getGithubFileContent } from "@/github/octokit.server"
import { Button } from "@/ui/components/base/button"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/ui/components/base/empty"
import { H2 } from "@/ui/components/base/typegraphy"
import type { Route } from "./+types/singleton"

type SchemaRecord = Record<string, Field>

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const { singleton_slug } = params
	const ctx = await requirePageContext({ context, params, request })
	const { env, installationId, name, owner } = ctx
	const { filePath, singleton } = requireSingleton(ctx, singleton_slug)

	const editorPath = `/${owner}/${name}/singletons/${singleton_slug}/editor`

	// The catch is only for "this singleton has not been created yet" — a parse
	// failure must never be mistaken for an absent file, so parsing happens after.
	let file: Awaited<ReturnType<typeof getGithubFileContent>> | null = null
	try {
		file = await getGithubFileContent(
			env,
			installationId,
			owner,
			name,
			filePath,
		)
	} catch (error) {
		if (
			!(error instanceof Error && "status" in error && error.status === 404)
		) {
			throw error
		}
	}

	// A ContentParseError here propagates: a writer must never be handed an empty
	// editor over a file kobun could not read.
	const contentDocument = file
		? parseDocument(file.content, singleton.format)
		: null

	return {
		singleton,
		singletonSlug: singleton_slug,
		exists: contentDocument !== null,
		data: contentDocument?.data ?? {},
		body: contentDocument?.body ?? null,
		filePath,
		editorPath,
	}
}

////////////////////// ORDERING //////////////////////

const TITLE_TARGETS = ["title", "name"] as const

/**
 * Title-ish Fields first, the Body last, everything else in declared order.
 *
 * The heuristic is the Title Role's fallback tier and belongs beside the other
 * two in `roles.ts`; #73 moves it there.
 */
function orderedSchemaEntries(schema: SchemaRecord): [string, Field][] {
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

	const titles: [string, Field][] = []
	const others: [string, Field][] = []
	const documents: [string, Field][] = []

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

	const blocks = buildFieldBlocks(ordered)

	const hasDocumentField = ordered.some(([, f]) => f.type === "document")
	const showFallbackBody =
		(singleton.format === "md" || singleton.format === "mdx") &&
		body != null &&
		!hasDocumentField

	const rootCtx: RenderContext = { depth: 0, accordionDepth: 0, owner, name }

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
					// Anything that is not rows is no rows, not a missing value: the
					// section still has to offer its "Add" link.
					const rows = data[block.key]
					return (
						<Fragment key={`array:${block.key}`}>
							{renderFieldValue(block.field, Array.isArray(rows) ? rows : [], {
								...rootCtx,
								editorPath,
								fieldKey: block.key,
							})}
						</Fragment>
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
									{renderFieldValue(field, data[key], rootCtx)}
								</FieldRow>
							)
						})}
					</dl>
				)
			})}

			{showFallbackBody && (
				<dl className="flex flex-col divide-y rounded-lg border">
					<FieldRow field={{ label: "Content", description: "Markdown body" }}>
						<DocumentValue value={body ?? ""} />
					</FieldRow>
				</dl>
			)}
		</div>
	)
}

/**
 * The Body, which is not a value: it never reaches the dispatcher, so its
 * presentation stays here with the rest of the page.
 */
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
