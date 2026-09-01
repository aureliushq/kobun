import { formatDistanceToNow } from "date-fns"
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import {
	AlertCircleIcon,
	ExternalLinkIcon,
	TriangleAlertIcon,
} from "lucide-react"
import { Suspense, useState } from "react"
import {
	Await,
	Link,
	redirect,
	useFetcher,
	useRouteLoaderData,
} from "react-router"
import { getAuth } from "@/auth/auth.server"
import { NO_CONFIG_ERROR, parseConfigErrors } from "@/config/errors"
import type { ConfigError } from "@/config/types"
import type { loader as dashboardLayoutLoader } from "@/core/components/layouts/dashboard"
import { envContext } from "@/core/context"
import { getDraftEditorPath, isDraftDirty } from "@/core/editor/drafts"
import type {
	ConfigProblem,
	ProjectContextDatabase,
} from "@/core/project-context"
import { dbContext } from "@/db/context"
import { editorDraft, project } from "@/db/schema/app-schema"
import { posthogContext } from "@/lib/posthog-middleware"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/ui/components/base/alert-dialog"
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
import { AsyncErrorAlert } from "@/ui/components/blocks/async-error-alert"
import { CardListSkeleton } from "@/ui/components/blocks/skeletons"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/dashboard"

const DISCARD_DRAFT_INTENT = "discard-draft"

/**
 * Three round-trips before a single Draft can be listed, none of which decides
 * whether this page may be seen — so the page does not wait on them (ADR 0006).
 *
 * The cleanup delete rides along inside the stream. It only removes Drafts that
 * are Synced, so running it late, twice, or — if the reader closes the tab
 * mid-stream — not at all costs nothing: the next dashboard load does it.
 */
async function loadDashboardDrafts(db: ProjectContextDatabase, userId: string) {
	const userProjects = await db.query.project.findMany({
		where: eq(project.userId, userId),
	})
	const projectIds = userProjects.map((projectRow) => projectRow.id)
	if (projectIds.length === 0) return []

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

	return db.query.editorDraft.findMany({
		where: inArray(editorDraft.projectId, projectIds),
		with: { project: true },
		orderBy: [desc(editorDraft.updatedAt)],
	})
}

export async function loader({ context, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	return { drafts: loadDashboardDrafts(db, session.user.id) }
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

/**
 * A Config the resolver could not classify at all — an unreachable repository
 * as much as a broken file. It gets its own arm rather than falling through to
 * "Invalid config", which would tell a writer whose Config is fine that it is
 * not.
 */
const UNREADABLE_CONFIG = "unreadable_config"

/**
 * What to tell a writer whose Project resolved without a Config (ADR-0007).
 * `syncProjectConfig` writes what it found on connect and on every refresh, and
 * the alerts below already know how to render one — so the stored list is what
 * this shows, and the problem only stands in when there is none to read.
 */
function configProblemErrors(
	problem: ConfigProblem,
	stored: string | null,
): ConfigError[] {
	const errors = parseConfigErrors(stored)
	if (errors.length > 0) return errors

	return [
		problem === "config-missing"
			? NO_CONFIG_ERROR
			: {
					code: UNREADABLE_CONFIG,
					message:
						"Kobun could not reach or read this repository's configuration. Refresh the configuration to try again.",
					path: "",
				},
	]
}

function UnreadableConfigAlert({ message }: { message: string }) {
	return (
		<Alert variant="destructive">
			<TriangleAlertIcon />
			<AlertTitle>Couldn&apos;t read your configuration</AlertTitle>
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	)
}

function ConfigAlert({ error }: { error: ConfigError }) {
	switch (error.code) {
		case "no_config":
			return <NoConfigAlert message={error.message} />
		case "parse_error":
			return <ParseErrorAlert filePath={error.path} message={error.message} />
		case UNREADABLE_CONFIG:
			return <UnreadableConfigAlert message={error.message} />
		default:
			return <ValidationErrorAlert path={error.path} message={error.message} />
	}
}

function DiscardDraftDialog({ draftId }: { draftId: string }) {
	const fetcher = useFetcher()
	const [open, setOpen] = useState(false)

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button size="sm" variant="ghost" />}>
				Discard
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Discard this draft?</AlertDialogTitle>
					<AlertDialogDescription>
						This can&apos;t be undone. The draft and any unpublished changes
						will be permanently deleted.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={fetcher.state !== "idle"}
						onClick={() => {
							fetcher.submit(
								{ intent: DISCARD_DRAFT_INTENT, draftId },
								{ method: "post" },
							)
							setOpen(false)
						}}
					>
						Discard
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

type DashboardDraft = Awaited<ReturnType<typeof loadDashboardDrafts>>[number]

function DraftsSection({ drafts }: { drafts: DashboardDraft[] }) {
	if (drafts.length === 0) return null

	return (
		<section className="flex flex-col gap-3 pt-4">
			<div>
				<h3 className="font-medium text-base">Drafts</h3>
				<p className="text-muted-foreground text-sm">
					Continue editing unpublished work.
				</p>
			</div>
			{drafts.map((draft) => {
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
								<Badge variant={dirty ? "secondary" : "outline"}>{state}</Badge>
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
								{/* The one link on this card worth warming; the title above
								    points at the same editor, and prefetching both would ask
								    for it twice. */}
								<Button
									size="sm"
									variant="outline"
									render={<Link prefetch="intent" to={href} />}
								>
									Continue
								</Button>
								<DiscardDraftDialog draftId={draft.id} />
							</div>
						</CardContent>
					</Card>
				)
			})}
		</section>
	)
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
	const layoutData = useRouteLoaderData<typeof dashboardLayoutLoader>(
		"core/components/layouts/dashboard",
	)
	const user = layoutData?.user
	// A Config that declares at least one Collection is served even when parts of
	// it did not validate, and it carries those errors with it — so the writer is
	// told what kobun could not read without losing the pages it could. A Project
	// with no Config at all resolves here too, and this is where it says so.
	const problem = layoutData?.configProblem ?? null
	const errors = problem
		? configProblemErrors(
				problem,
				layoutData?.activeProject.configError ?? null,
			)
		: (layoutData?.config?.errors ?? [])

	return (
		<>
			<H2>{`Welcome ${user?.name}!`}</H2>
			{/* Above the Drafts, because these arrive with the page while the
			    Drafts are still streaming: anything rendered below a skeleton is
			    pushed up the moment that skeleton turns out to stand for nothing.
			    A broken Config is also the more urgent of the two to read. */}
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
			<Suspense fallback={<CardListSkeleton count={2} />}>
				<Await
					errorElement={<AsyncErrorAlert title="Couldn't load your drafts" />}
					resolve={loaderData.drafts}
				>
					{(drafts: DashboardDraft[]) => <DraftsSection drafts={drafts} />}
				</Await>
			</Suspense>
		</>
	)
}
