import { createContext, useContext, useEffect } from "react"
import type { AutosaveState } from "@/editor"

export interface EditorLayoutControls {
	autosaveState: AutosaveState
	canPublish: boolean
	canSave: boolean
	/**
	 * The properties panel's open state and its toggle, for routes that have
	 * one. The layout owns the header, so the button lives there; the route
	 * still owns the state. Routes without a panel leave both undefined and the
	 * header renders no toggle.
	 */
	isPropertiesOpen?: boolean
	publish: () => Promise<void>
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
