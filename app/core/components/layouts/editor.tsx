import { ChevronLeft, PanelRightClose, PanelRightOpen } from "lucide-react"
import { useMemo, useState } from "react"
import { Link, Outlet } from "react-router"
import invariant from "tiny-invariant"
import { getCollectionPath } from "@/core/editor/drafts"
import { requireCollection, requireSingleton } from "@/core/project-context"
import { requirePageContext } from "@/core/project-context/project-context.server"
import { Button } from "@/ui/components/base/button"
import type { Route } from "./+types/editor"
import {
	EditorLayoutContext,
	type EditorLayoutControls,
} from "./editor-context"

/**
 * The chrome around an editor answers to the same seam its content does, so the
 * two can never disagree about whether this user may see this Project — and the
 * header names the entity the URL names, rather than an entity the page below
 * it turned out not to have.
 */
export async function loader({ context, params, request }: Route.LoaderArgs) {
	const { collection_slug, name, owner, singleton_slug } = params
	const ctx = await requirePageContext({ context, params, request })

	if (singleton_slug) {
		const { singleton } = requireSingleton(ctx, singleton_slug)
		return {
			parentLabel: singleton.label,
			parentPath: `/${owner}/${name}/singletons/${singleton_slug}`,
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
	}
}

/**
 * The three things the header can ask the editor to do. Save and Save to GitHub
 * differ in target and nothing else; Publish means something else entirely, and
 * exists only where the Collection has a Publication State to declare (ADR-0008).
 */
type EditorAction = "save" | "commit" | "publish"

const EditorLayout = ({ loaderData }: Route.ComponentProps) => {
	const { parentLabel, parentPath } = loaderData
	const [controls, setControls] = useState<EditorLayoutControls | null>(null)
	const [pendingAction, setPendingAction] = useState<EditorAction | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const contextValue = useMemo(() => ({ setControls }), [])

	const runAction = async (action: EditorAction) => {
		const run = controls?.[action]
		if (!run) return
		setPendingAction(action)
		setActionError(null)
		try {
			await run()
		} catch (error) {
			setActionError(
				error instanceof Error ? error.message : "Editor action failed",
			)
		} finally {
			setPendingAction(null)
		}
	}

	const saveStatus = actionError
		? actionError
		: pendingAction === "save" || controls?.autosaveState.isSaving
			? "Saving…"
			: controls?.autosaveState.isDirty
				? "Unsaved changes"
				: controls?.autosaveState.lastSavedAt
					? "Saved"
					: null

	return (
		<EditorLayoutContext.Provider value={contextValue}>
			<main className="flex h-screen w-screen flex-col divide-y">
				<header className="flex h-14 shrink-0 items-center justify-between gap-4 px-6">
					<div className="flex items-center gap-2">
						<Link to={parentPath}>
							<Button variant="ghost" size="icon">
								<ChevronLeft className="size-4" />
							</Button>
						</Link>
						<span className="font-medium text-sm">{parentLabel}</span>
					</div>
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
						{saveStatus && (
							<span
								className={
									actionError
										? "text-destructive text-xs"
										: "text-muted-foreground text-xs"
								}
							>
								{saveStatus}
							</span>
						)}
						<Button
							type="button"
							variant="outline"
							disabled={
								!controls?.canSave ||
								!controls.autosaveState.isDirty ||
								controls.autosaveState.isSaving ||
								pendingAction !== null
							}
							onClick={() => void runAction("save")}
						>
							Save
						</Button>
						{/* Two buttons for now; #107 folds them into one split
						    control that remembers which target the writer chose. */}
						<Button
							type="button"
							variant="outline"
							disabled={
								!controls?.canCommit ||
								controls.autosaveState.isSaving ||
								pendingAction !== null
							}
							onClick={() => void runAction("commit")}
						>
							{pendingAction === "commit"
								? "Saving to GitHub…"
								: "Save to GitHub"}
						</Button>
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
								{pendingAction === "publish" ? "Publishing…" : "Publish"}
							</Button>
						) : null}
					</div>
				</header>
				<section className="flex-1 overflow-auto">
					<Outlet />
				</section>
			</main>
		</EditorLayoutContext.Provider>
	)
}

export default EditorLayout
