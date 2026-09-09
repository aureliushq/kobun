import { ChevronLeft, PanelRightClose, PanelRightOpen } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Link, Outlet, useBeforeUnload, useBlocker } from "react-router"
import invariant from "tiny-invariant"
import { getCollectionPath } from "@/core/editor/drafts"
import { toPrimaryEditorAction } from "@/core/editor/primary-action"
import { requireCollection, requireSingleton } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { readEditorPrimaryAction } from "@/db/user-preference"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/ui/components/base/alert-dialog"
import { Button } from "@/ui/components/base/button"
import { cn } from "@/ui/lib/utils"
import type { Route } from "./+types/editor"
import {
	EditorLayoutContext,
	type EditorLayoutControls,
} from "./editor-context"
import { EditorSaveControl } from "./editor-save-control"
import { usePrimaryEditorAction } from "./use-primary-editor-action"

/**
 * The chrome around an editor answers to the same seam its content does, so the
 * two can never disagree about whether this user may see this Project — and the
 * header names the entity the URL names, rather than an entity the page below
 * it turned out not to have.
 */
export async function loader({ context, params, request }: Route.LoaderArgs) {
	const { collection_slug, name, owner, singleton_slug } = params
	const ctx = await requirePageContext({ context, params, request })
	// Which target the split control's primary button runs, keyed by the writer
	// `requirePageContext` already resolved — so the choice follows them to
	// another browser (ADR-0010).
	//
	// A second read of a row root has already fetched, and deliberately: root
	// answers with the Preferences the account page owns, and the save target is
	// not one of them. Paying for it here rather than widening that set keeps the
	// one Preference chosen somewhere else out of the shape every other surface
	// reads — at the cost of one more lookup by primary key, on the one page that
	// asks.
	const primaryAction = toPrimaryEditorAction(
		await readEditorPrimaryAction(ctx.db, ctx.session.user.id),
	)

	if (singleton_slug) {
		const { singleton } = requireSingleton(ctx, singleton_slug)
		return {
			parentLabel: singleton.label,
			parentPath: `/${owner}/${name}/singletons/${singleton_slug}`,
			primaryAction,
		}
	}

	// Neither slug: the route matched a URL that names no entity to go back to.
	invariant(collection_slug, "collection_slug is required")
	const { collection } = requireCollection(ctx, collection_slug)

	return {
		parentLabel: collection.label,
		parentPath: getCollectionPath(
			{ repoName: name, repoOwnerLogin: owner },
			collection_slug,
		),
		primaryAction,
	}
}

/**
 * The three things the header can ask the editor to do. Save and Save to GitHub
 * differ in target and nothing else; Publish means something else entirely, and
 * exists only where the Collection has a Publication State to declare (ADR-0008).
 */
type EditorAction = "save" | "commit" | "publish"

/**
 * What is happening, in words that name the target it happened to.
 *
 * A bare "Saved" is the one thing this may not say. Autosave to D1 runs
 * whatever the primary is, so a writer whose button reads "Save to GitHub" can
 * reasonably read an unqualified "Saved" as "committed" — which would be a lie
 * about where their work is (ADR-0008).
 *
 * The last two rungs come from the domain rather than from a completion flag.
 * After a Save to GitHub the Draft is deleted but `lastSavedAt` still holds the
 * earlier autosave, so a ladder ending on it alone would call a real commit a
 * kept Draft — the same misreading, inverted.
 */
function saveStatusFor(
	actionError: string | null,
	pendingAction: EditorAction | null,
	controls: EditorLayoutControls | null,
	hasActed: boolean,
) {
	if (actionError) return actionError
	if (pendingAction === "publish") return "Publishing…"
	if (pendingAction === "commit") return "Saving to GitHub…"
	if (pendingAction === "save" || controls?.autosaveState.isSaving)
		return "Saving draft…"
	if (controls?.autosaveState.isDirty) return "Draft not saved yet"
	if (controls?.hasUncommittedWork) return "Draft saved, not on GitHub"
	// Both halves are needed. The state says the repository holds everything,
	// and one of these says this session put it there — without that, an item
	// opened and left alone would claim a save nobody made, and a new item that
	// GitHub has never heard of would claim the loudest one of all.
	if (hasActed || controls?.autosaveState.lastSavedAt) return "Saved to GitHub"
	return ""
}

const EditorLayout = ({ loaderData }: Route.ComponentProps) => {
	const { parentLabel, parentPath } = loaderData
	const [controls, setControls] = useState<EditorLayoutControls | null>(null)
	const [pendingAction, setPendingAction] = useState<EditorAction | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	// Whether this editor session has put the writer's work anywhere yet. The
	// autosave's own `lastSavedAt` answers it for typing; an action that ran to
	// completion answers it for a commit or a publish, which never touch it.
	const [hasActed, setHasActed] = useState(false)
	const contextValue = useMemo(() => ({ setControls }), [])
	const { primaryAction, setPrimaryAction } = usePrimaryEditorAction(
		loaderData.primaryAction,
	)

	const runAction = async (action: EditorAction) => {
		const run = controls?.[action]
		if (!run) return
		setPendingAction(action)
		setActionError(null)
		try {
			await run()
			setHasActed(true)
		} catch (error) {
			setActionError(
				error instanceof Error ? error.message : "Editor action failed",
			)
		} finally {
			setPendingAction(null)
		}
	}

	const saveStatus = saveStatusFor(
		actionError,
		pendingAction,
		controls,
		hasActed,
	)

	/**
	 * The condition the warning is about: the writer asked for the repository to
	 * be where their work is, and it is not. Held here rather than in the editor
	 * because only the header knows which target they chose.
	 */
	const leavingWouldStrand =
		primaryAction === "commit" && controls?.hasUncommittedWork === true

	/**
	 * A writer who chose Save to GitHub asked for the repository to be where
	 * their work is. Leaving with it behind is worth stopping for — the Draft is
	 * safe in D1, but that is not what they asked for (ADR-0008).
	 *
	 * Two guards, both load-bearing. Comparing pathnames lets the `?draft=`
	 * adoption through, which is a search-only replace and not a writer walking
	 * away. `pendingAction === null` lets the navigations a commit or a publish
	 * ends on through: those run inside the awaited action, and the state update
	 * that clears `hasUncommittedWork` is not guaranteed to have flushed by then.
	 */
	const blocker = useBlocker(
		({ currentLocation, nextLocation }) =>
			leavingWouldStrand &&
			pendingAction === null &&
			currentLocation.pathname !== nextLocation.pathname,
	)

	// Closing the tab is leaving too. The browser's own dialogue carries no
	// message, which is why the blocker above exists; this is only the half that
	// catches an exit React Router never sees.
	useBeforeUnload(
		useCallback(
			(event: BeforeUnloadEvent) => {
				if (leavingWouldStrand) event.preventDefault()
			},
			[leavingWouldStrand],
		),
	)

	// The editor cannot act at all. `canSave` and `canCommit` are asked
	// separately because the route states them separately, even where they
	// happen to agree.
	const busy =
		!controls ||
		controls.autosaveState.isSaving ||
		pendingAction !== null ||
		!controls.canSave ||
		!controls.canCommit
	// Save keeps the gate it has always had — there is nothing to keep when
	// nothing changed. Save to GitHub never had one: committing a Draft that
	// happens to match its Source is a no-op the drafts module already decides.
	const nothingToRun =
		primaryAction === "save" && controls?.autosaveState.isDirty === false

	return (
		<EditorLayoutContext.Provider value={contextValue}>
			<main className="flex h-screen w-screen flex-col divide-y">
				{/* Three tracks rather than one flex row: the actions sit in the
				    `auto` one, so their left edge is a function of the controls
				    alone and a status message of any length — an error is an
				    arbitrary server string — cannot push them about. */}
				<header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 px-6">
					<div className="flex min-w-0 items-center gap-2">
						<Link to={parentPath}>
							<Button variant="ghost" size="icon">
								<ChevronLeft className="size-4" />
							</Button>
						</Link>
						<span className="truncate font-medium text-sm">{parentLabel}</span>
					</div>
					{/* Rendered even when empty, so a screen reader has a stable
					    region to be told about saves in. */}
					<span
						aria-live="polite"
						className={cn(
							"justify-self-end truncate text-xs",
							actionError ? "text-destructive" : "text-muted-foreground",
						)}
						data-testid="editor-save-status"
						title={saveStatus}
					>
						{saveStatus}
					</span>
					<div className="flex items-center gap-3">
						{controls?.toggleProperties ? (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={
									controls.isPropertiesOpen
										? "Close properties"
										: "Open properties"
								}
								aria-pressed={controls.isPropertiesOpen}
								onClick={controls.toggleProperties}
							>
								{controls.isPropertiesOpen ? (
									<PanelRightClose />
								) : (
									<PanelRightOpen />
								)}
							</Button>
						) : null}
						<EditorSaveControl
							disabled={busy}
							onRun={(target) => void runAction(target)}
							onTargetChange={setPrimaryAction}
							runDisabled={nothingToRun}
							target={primaryAction}
						/>
						{/* Absent, not disabled, where the Collection has no `publish`
						    Feature: there is nothing for it to do that Save to GitHub
						    does not already do. */}
						{controls?.publish ? (
							<Button
								type="button"
								disabled={
									!controls.canPublish ||
									controls.autosaveState.isSaving ||
									pendingAction !== null
								}
								title={controls.publishDisabledReason}
								onClick={() => void runAction("publish")}
							>
								Publish
							</Button>
						) : null}
					</div>
				</header>
				<section className="flex-1 overflow-auto">
					<Outlet />
				</section>
			</main>
			<AlertDialog
				open={blocker.state === "blocked"}
				onOpenChange={(open) => {
					if (!open) blocker.reset?.()
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>This isn&apos;t on GitHub yet</AlertDialogTitle>
						<AlertDialogDescription>
							Your work is saved as a draft in Kobun, so nothing is lost. It
							just hasn&apos;t been committed to the repository. Save to GitHub
							before you go, or come back to it later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => blocker.reset?.()}>
							Stay
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => blocker.proceed?.()}>
							Leave anyway
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</EditorLayoutContext.Provider>
	)
}

export default EditorLayout
