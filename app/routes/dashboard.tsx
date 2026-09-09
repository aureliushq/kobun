import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { Suspense, useState } from "react"
import {
	Await,
	Link,
	redirect,
	useFetcher,
	useRouteLoaderData,
} from "react-router"
import { getAuth } from "@/auth/auth.server"
import type { loader as dashboardLayoutLoader } from "@/core/components/layouts/dashboard"
import { envContext } from "@/core/context"
import {
	DRAFT_MARKER_LABELS,
	draftHeading,
	draftMarker,
	getDraftEditorPath,
	isDraftDirty,
} from "@/core/editor/drafts"
import { Timestamp } from "@/core/preferences/timestamp"
import type { ProjectContextDatabase } from "@/core/project-context"
import { lastKnownConfig } from "@/core/project-context"
import { ConfigAlerts } from "@/core/project-context/config-alerts"
import { configErrors } from "@/core/project-context/config-errors"
import { dbContext } from "@/db/context"
import { editorDraft, project } from "@/db/schema/app-schema"
import { posthogContext } from "@/lib/posthog-middleware"
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
 *
 * A card is headed by the Draft's Title and names its Collection by that
 * Collection's label, both of which need the Project's Config — and the Config
 * the cache last stored is already on the Project row, so neither costs a
 * fourth round-trip. It is read here rather than in the card because the row
 * carries a whole parsed Config, which no browser needs to hold to render a
 * heading.
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
				isNotNull(editorDraft.committedRevision),
				isNotNull(editorDraft.committedAt),
				sql`${editorDraft.revision} = ${editorDraft.committedRevision}`,
			),
		)

	// Read once per Project rather than once per Draft: a writer with a dozen
	// Drafts in one Collection has one Config between them.
	const configs = new Map(
		userProjects.map((projectRow) => [
			projectRow.id,
			lastKnownConfig(projectRow),
		]),
	)

	const drafts = await db.query.editorDraft.findMany({
		where: inArray(editorDraft.projectId, projectIds),
		with: { project: true },
		orderBy: [desc(editorDraft.updatedAt)],
	})

	return drafts.map((draft) => {
		// A Collection the Config no longer declares still has Drafts, and they
		// are still reachable — so the card falls back to the slug rather than
		// dropping the row.
		const collection =
			configs.get(draft.projectId)?.collections[draft.collectionSlug] ?? null
		return {
			collectionLabel: collection?.label ?? draft.collectionSlug,
			collectionSlug: draft.collectionSlug,
			heading: draftHeading(draft, collection),
			id: draft.id,
			itemSlug: draft.itemSlug,
			project: {
				repoName: draft.project.repoName,
				repoOwnerLogin: draft.project.repoOwnerLogin,
			},
			committedRevision: draft.committedRevision,
			revision: draft.revision,
			sourcePath: draft.sourcePath,
			updatedAt: draft.updatedAt,
		}
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
						This can&apos;t be undone. The draft and any changes the repository
						does not have will be permanently deleted.
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
					Continue editing work in progress.
				</p>
			</div>
			{drafts.map((draft) => {
				const dirty = isDraftDirty(draft)
				const href = getDraftEditorPath(draft, draft.project)
				// Where the Draft stands with the repository, and nothing more. A
				// card never fetches the Source, so it has no Publication State to
				// read — and the label that used to call a Clean Draft "Published"
				// was answering a question it had not asked (ADR-0008, #127).
				const state = DRAFT_MARKER_LABELS[draftMarker(draft)]
				return (
					<Card key={draft.id} size="sm">
						{/* An explicit `minmax(0, 1fr)` column: the header's implicit one
						    is sized to its content, which a long title would grow past
						    rather than be cut off inside. */}
						<CardHeader className="grid-cols-[minmax(0,1fr)]">
							{/* One line, whatever the writer typed — the rest is a hover
							    away, through the attribute the browser already reveals. */}
							<CardTitle className="truncate" title={draft.heading}>
								<Link className="hover:underline" to={href}>
									{draft.heading}
								</Link>
							</CardTitle>
							<CardDescription className="truncate">
								{draft.collectionLabel} · {draft.project.repoOwnerLogin}/
								{draft.project.repoName}
							</CardDescription>
						</CardHeader>
						{/* State and time sit down here with the actions rather than level
						    with the title, which is the only thing on the card that should
						    be read first. */}
						<CardContent className="flex items-center justify-between gap-4">
							<div className="flex min-w-0 items-center gap-2">
								<Badge variant={dirty ? "secondary" : "outline"}>{state}</Badge>
								<span className="truncate text-muted-foreground">
									Edited <Timestamp value={new Date(draft.updatedAt)} />
								</span>
							</div>
							<div className="flex shrink-0 items-center gap-2">
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
	const errors = configErrors(
		layoutData?.config ?? null,
		layoutData?.configProblem ?? null,
		layoutData?.activeProject.configError ?? null,
	)

	return (
		<>
			<H2>{`Welcome ${user?.name}!`}</H2>
			{/* Above the Drafts, because these arrive with the page while the
			    Drafts are still streaming: anything rendered below a skeleton is
			    pushed up the moment that skeleton turns out to stand for nothing.
			    A broken Config is also the more urgent of the two to read. */}
			<ConfigAlerts errors={errors} />
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
