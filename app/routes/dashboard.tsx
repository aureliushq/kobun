import { formatDistanceToNow } from "date-fns"
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import {
	AlertCircleIcon,
	ExternalLinkIcon,
	TriangleAlertIcon,
} from "lucide-react"
import { Link, redirect, useFetcher, useRouteLoaderData } from "react-router"
import { getAuth } from "@/auth/auth.server"
import type { ConfigFetchResult } from "@/config/github.server"
import type { loader as dashboardLayoutLoader } from "@/core/components/layouts/dashboard"
import { envContext } from "@/core/context"
import { getDraftEditorPath, isDraftDirty } from "@/core/editor/drafts"
import { dbContext } from "@/db/context"
import { editorDraft, project } from "@/db/schema/app-schema"
import { posthogContext } from "@/lib/posthog-middleware"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import { H2 } from "@/ui/components/base/typegraphy"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/dashboard"

const DISCARD_DRAFT_INTENT = "discard-draft"

export async function loader({ context, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const userProjects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
	})
	const projectIds = userProjects.map((projectRow) => projectRow.id)
	if (projectIds.length === 0) return { drafts: [] }

	await db
		.delete(editorDraft)
		.where(
			and(
				inArray(editorDraft.projectId, projectIds),
				isNotNull(editorDraft.publishedRevision),
				isNotNull(editorDraft.publishedAt),
				sql`${editorDraft.revision} = ${editorDraft.publishedRevision}`,
			),
		)

	const drafts = await db.query.editorDraft.findMany({
		where: inArray(editorDraft.projectId, projectIds),
		with: { project: true },
		orderBy: [desc(editorDraft.updatedAt)],
	})
	return { drafts }
}

export async function action({ context, request }: Route.ActionArgs) {
	const db = context.get(dbContext)
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const formData = await request.formData()
	if (formData.get("intent") !== DISCARD_DRAFT_INTENT) {
		throw new Response("Unknown dashboard action", { status: 400 })
	}
	const draftId = formData.get("draftId")
	if (typeof draftId !== "string") {
		throw new Response("Draft ID is required", { status: 400 })
	}

	const draft = await db.query.editorDraft.findFirst({
		where: eq(editorDraft.id, draftId),
		with: { project: true },
	})
	if (!draft || draft.project.userId !== session.user.id) {
		throw new Response("Not Found", { status: 404 })
	}
	await db.delete(editorDraft).where(eq(editorDraft.id, draft.id))

	const posthog = context.get(posthogContext)
	posthog?.capture({
		event: "draft_discarded",
		properties: {
			collection_slug: draft.collectionSlug,
		},
	})

	return { ok: true }
}

function NoConfigAlert({ message }: { message: string }) {
	return (
		<Alert variant="destructive">
			<AlertCircleIcon />
			<AlertTitle>Configuration file missing</AlertTitle>
			<AlertDescription>
				{message}{" "}
				<a
					className="inline-flex items-center gap-1"
					href="https://kobun.io/docs/configuration"
				>
					Learn more <ExternalLinkIcon className="size-3.5" />{" "}
				</a>
			</AlertDescription>
		</Alert>
	)
}

function ParseErrorAlert({
	filePath,
	message,
}: {
	filePath: string
	message: string
}) {
	return (
		<Alert variant="destructive">
			<AlertCircleIcon />
			<AlertTitle>Failed to parse config</AlertTitle>
			<AlertDescription>
				Could not parse{" "}
				<code className="wrap-break-words relative inline rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
					{filePath}
				</code>
				: {message}
			</AlertDescription>
		</Alert>
	)
}

function ValidationErrorAlert({
	path,
	message,
}: {
	path: string
	message: string
}) {
	return (
		<Alert variant="destructive">
			<TriangleAlertIcon />
			<AlertTitle>Invalid config</AlertTitle>
			<AlertDescription>
				{path && (
					<code className="wrap-break-words relative mr-1 inline rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
						{path}
					</code>
				)}
				{message}
			</AlertDescription>
		</Alert>
	)
}

function ConfigAlert({
	error,
}: {
	error: ConfigFetchResult["errors"][number]
}) {
	switch (error.code) {
		case "no_config":
			return <NoConfigAlert message={error.message} />
		case "parse_error":
			return <ParseErrorAlert filePath={error.path} message={error.message} />
		default:
			return <ValidationErrorAlert path={error.path} message={error.message} />
	}
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
	const layoutData = useRouteLoaderData<typeof dashboardLayoutLoader>(
		"core/components/layouts/dashboard",
	)
	const discardFetcher = useFetcher()
	const user = layoutData?.user
	const _config = layoutData?.configResult?.config
	const errors = layoutData?.configResult?.errors ?? []

	return (
		<>
			<H2>{`Welcome ${user?.name}!`}</H2>
			{loaderData.drafts.length > 0 && (
				<section className="flex flex-col gap-3 pt-4">
					<div>
						<h3 className="font-medium text-base">Drafts</h3>
						<p className="text-muted-foreground text-sm">
							Continue editing unpublished work.
						</p>
					</div>
					{loaderData.drafts.map((draft) => {
						const dirty = isDraftDirty(draft)
						const href = getDraftEditorPath(draft, draft.project)
						const state =
							draft.publishedRevision === null
								? "Unpublished"
								: dirty
									? "Unsaved changes"
									: "Published"
						return (
							<Card key={draft.id} size="sm">
								<CardHeader>
									<CardTitle>
										<Link className="hover:underline" to={href}>
											{draft.itemSlug ?? `New ${draft.collectionSlug} item`}
										</Link>
									</CardTitle>
									<CardDescription>
										{draft.project.repoOwnerLogin}/{draft.project.repoName} ·{" "}
										{draft.collectionSlug}
									</CardDescription>
									<CardAction>
										<Badge variant={dirty ? "secondary" : "outline"}>
											{state}
										</Badge>
									</CardAction>
								</CardHeader>
								<CardContent className="flex items-center justify-between gap-4">
									<span className="text-muted-foreground">
										Edited{" "}
										{formatDistanceToNow(new Date(draft.updatedAt), {
											addSuffix: true,
										})}
									</span>
									<div className="flex items-center gap-2">
										<Button
											size="sm"
											variant="outline"
											render={<Link to={href} />}
										>
											Continue
										</Button>
										<discardFetcher.Form
											method="post"
											onSubmit={(event) => {
												if (
													!window.confirm("Discard this draft permanently?")
												) {
													event.preventDefault()
												}
											}}
										>
											<input
												type="hidden"
												name="intent"
												value={DISCARD_DRAFT_INTENT}
											/>
											<input type="hidden" name="draftId" value={draft.id} />
											<Button type="submit" size="sm" variant="ghost">
												Discard
											</Button>
										</discardFetcher.Form>
									</div>
								</CardContent>
							</Card>
						)
					})}
				</section>
			)}
			{errors.length > 0 && (
				<>
					<p>We found the following errors in your configuration:</p>
					<div className="flex flex-col gap-3 pt-3">
						{errors.map((error, i) => (
							<ConfigAlert
								error={error}
								// biome-ignore lint/suspicious/noArrayIndexKey: it's fine
								key={i}
							/>
						))}
					</div>
				</>
			)}
		</>
	)
}
