import { createContext, useContext, useEffect } from "react"
import type { AutosaveState } from "@/editor"

export interface EditorLayoutControls {
	autosaveState: AutosaveState
	/** Save to GitHub: a Commit and nothing else (ADR-0008). */
	canCommit: boolean
	canPublish: boolean
	canSave: boolean
	commit: () => Promise<void>
	/**
	 * Whether the repository is behind what the writer has: a Draft holding
	 * bytes the Source lacks, or keystrokes autosave has not persisted yet. The
	 * header warns on it when Save to GitHub is the primary (ADR-0008).
	 */
	hasUncommittedWork: boolean
	/**
	 * The properties panel's open state and its toggle, for routes that have
	 * one. The layout owns the header, so the button lives there; the route
	 * still owns the state. Routes without a panel leave both undefined and the
	 * header renders no toggle.
	 */
	isPropertiesOpen?: boolean
	/**
	 * Undefined where the Collection has no `publish` Feature: there is no
	 * Publication State to declare, so the header renders no Publish button and
	 * Save to GitHub is the only path to the repository.
	 */
	publish?: () => Promise<void>
	publishDisabledReason?: string
	save: () => Promise<void>
	toggleProperties?: () => void
}

interface EditorLayoutContextValue {
	setControls: (controls: EditorLayoutControls | null) => void
}

export const EditorLayoutContext = createContext<
	EditorLayoutContextValue | undefined
>(undefined)

export function useEditorLayoutControls(controls: EditorLayoutControls) {
	const context = useContext(EditorLayoutContext)
	if (!context) {
		throw new Error("useEditorLayoutControls must be used inside EditorLayout")
	}

	useEffect(() => {
		context.setControls(controls)
		return () => context.setControls(null)
	}, [context, controls])
}
