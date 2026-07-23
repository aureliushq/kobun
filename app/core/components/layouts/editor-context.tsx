import { createContext, useContext, useEffect } from "react"
import type { AutosaveState } from "@/editor"

export interface EditorLayoutControls {
	autosaveState: AutosaveState
	canPublish: boolean
	canSave: boolean
	publish: () => Promise<void>
	publishDisabledReason?: string
	save: () => Promise<void>
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
