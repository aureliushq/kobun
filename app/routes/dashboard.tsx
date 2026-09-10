import { eq } from "drizzle-orm"
import { FileTextIcon } from "lucide-react"
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
	DASHBOARD_DRAFT_LIMIT,
	type DashboardDrafts,
	DRAFT_MARKER_LABELS,
	draftMarker,
	getCollectionPath,
	getDraftEditorPath,
	isDraftDirty,
	loadDashboardDrafts,
} from "@/core/editor/drafts"
import { Timestamp } from "@/core/preferences/timestamp"
import { ConfigAlerts } from "@/core/project-context/config-alerts"
import { configErrors } from "@/core/project-context/config-errors"
import { dbContext } from "@/db/context"
import { editorDraft } from "@/db/schema/app-schema"
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
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/ui/components/base/empty"
import { H2 } from "@/ui/components/base/typegraphy"
import { AsyncErrorAlert } from "@/ui/components/blocks/async-error-alert"
import { CardListSkeleton } from "@/ui/components/blocks/skeletons"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/dashboard"

const DISCARD_DRAFT_INTENT = "discard-draft"

/** How the writer asks for the Drafts the bounded list left out. */
const ALL_DRAFTS_PARAM = "drafts"

export async function loader({ context, request, url }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const auth = getAuth(context.get(envContext))
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	// The list is bounded unless the writer says otherwise, and the promise is
	// created below the guard so a request that redirects leaves no query behind
	// it (ADR-0006).
	return {
		drafts: loadDashboardDrafts(db, session.user.id, {
			all: url.searchParams.get(ALL_DRAFTS_PARAM) === "all",
		}),
	}
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

/** Where the writer would start a Draft, when the Config names somewhere. */
interface StartHere {
	href: string
	label: string
}

type DashboardLayoutData = ReturnType<
	typeof useRouteLoaderData<typeof dashboardLayoutLoader>
>

/**
 * The first Collection the active Project's Config declares, or nothing when it
 * declares none — which includes a Config Kobun could not read at all.
 */
function firstCollection(layoutData: DashboardLayoutData): StartHere | null {
	if (!layoutData) return null

	const [entry] = Object.entries(layoutData.config?.collections ?? {})
	if (!entry) return null

	const [slug, collection] = entry
	return {
		href: getCollectionPath(layoutData.activeProject, slug),
		label: collection.label,
	}
}

/**
 * A writer with no Drafts at all. Reached rather than skipped, because the
 * section streams behind a skeleton and a skeleton that resolves to nothing
 * leaves a new writer looking at empty space (ADR-0006, #142).
 *
 * The button is conditional for the reason ADR-0007 gives: a Project whose
 * Config will not read still has a dashboard, and it has no Collection to open.
 * Such a writer is not left without a next step — the Config alert above this
 * section names what went wrong and links to the docs, and fixing that comes
 * before starting a Draft.
 */
function NoDrafts({ startHere }: { startHere: StartHere | null }) {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FileTextIcon />
				</EmptyMedia>
				<EmptyTitle>No drafts</EmptyTitle>
				<EmptyDescription>
					A draft appears here the moment you start writing, and stays until the
					repository has it.
				</EmptyDescription>
			</EmptyHeader>
			{startHere && (
				<EmptyContent>
					{/* Warmed on intent like every other Collection link, which
					    ADR-0011's cached listing is what makes affordable. */}
					<Button render={<Link prefetch="intent" to={startHere.href} />}>
						Open {startHere.label}
					</Button>
				</EmptyContent>
			)}
		</Empty>
	)
}

/**
 * The rest of the Drafts, and the way back.
 *
 * Neither of these two links prefetches, unlike every other link on this page.
 * Hovering one runs this route's loader, and that loader carries the cleanup
 * delete — a write behind a GET that ADR-0006 already calls out as a shape not
 * to copy. One hover target for it is tolerable; three are not.
 */
function DraftsOverflow({
	shown,
	showingAll,
	total,
}: {
	shown: number
	showingAll: boolean
	total: number
}) {
	if (showingAll) {
		return (
			<p className="text-muted-foreground text-sm">
				Showing all {total} drafts ·{" "}
				<Link className="underline hover:text-foreground" to={{ search: "" }}>
					Show fewer
				</Link>
			</p>
		)
	}

	const hidden = total - shown
	return (
		<p className="text-muted-foreground text-sm">
			{hidden} more draft{hidden === 1 ? "" : "s"} ·{" "}
			<Link
				className="underline hover:text-foreground"
				to={{ search: `?${ALL_DRAFTS_PARAM}=all` }}
			>
				Show all {total}
			</Link>
		</p>
	)
}

function DraftsSection({
	drafts,
	showingAll,
	startHere,
	total,
}: DashboardDrafts & { startHere: StartHere | null }) {
	return (
		<section className="flex flex-col gap-3 pt-4">
			<div>
				<h3 className="font-medium text-base">Drafts</h3>
				{/* Nothing to continue is not an instruction to continue, so the
				    empty state below carries the whole of what this section says. */}
				{drafts.length > 0 && (
					<p className="text-muted-foreground text-sm">
						Continue editing work in progress.
					</p>
				)}
			</div>
			{drafts.length === 0 && <NoDrafts startHere={startHere} />}
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
			{/* Nothing to say when the cap never bit: a writer who asked for all
			    of five is looking at the same five the bounded list would show. */}
			{total > DASHBOARD_DRAFT_LIMIT && (
				<DraftsOverflow
					shown={drafts.length}
					showingAll={showingAll}
					total={total}
				/>
			)}
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
	// The first Collection the Config declares, which is the one at the top of
	// the sidebar: it builds its nav list from the same record, in the same
	// order, so "first" is somewhere the writer has already seen rather than an
	// arbitrary pick.
	const startHere = firstCollection(layoutData)

	return (
		<>
			<H2>{`Welcome ${user?.name}!`}</H2>
			{/* Above the Drafts, because these arrive with the page while the
			    Drafts are still streaming: anything rendered below a skeleton is
			    pushed up the moment that skeleton turns out to stand for nothing.
			    A broken Config is also the more urgent of the two to read. */}
			<ConfigAlerts errors={errors} />
			{/* Unkeyed, though `?drafts=all` now addresses this section's data: a
			    key comes from the path and never from the search (ADR-0006's sixth
			    rule). Expanding the list therefore delays the commit rather than
			    falling back, which is what should happen — the five cards already
			    on screen are correct, just fewer than asked for. */}
			<Suspense fallback={<CardListSkeleton count={2} />}>
				<Await
					errorElement={<AsyncErrorAlert title="Couldn't load your drafts" />}
					resolve={loaderData.drafts}
				>
					{(drafts: DashboardDrafts) => (
						<DraftsSection {...drafts} startHere={startHere} />
					)}
				</Await>
			</Suspense>
		</>
	)
}
