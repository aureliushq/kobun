import type { Editor } from "@tiptap/core"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { AutosaveState, PersistenceAdapter } from "../types"

interface UseAutosaveOptions {
	delay?: number
	editor: Editor | null
	persistence?: PersistenceAdapter
}

interface UseAutosaveResult extends AutosaveState {
	hasUnsavedChanges: () => boolean
	markContentSaved: (markdown: string) => void
	markCurrentContentClean: () => void
}

const initialState: AutosaveState = {
	isDirty: false,
	isSaving: false,
	lastSavedAt: null,
}

interface PendingUnmountSave {
	generation: number
	onAutoSave?: PersistenceAdapter["onAutoSave"]
	snapshot: string
}

export function useAutosave({
	delay = 1000,
	editor,
	persistence,
}: UseAutosaveOptions): UseAutosaveResult {
	const [state, setState] = useState(initialState)
	const stateRef = useRef(initialState)
	const baselineRef = useRef("")
	const dirtyRef = useRef(false)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const activeSaveRef = useRef<Promise<void> | null>(null)
	const saveRequestedRef = useRef(false)
	const pendingUnmountSaveRef = useRef<PendingUnmountSave | null>(null)
	const editorRef = useRef(editor)
	const initializedEditorRef = useRef<Editor | null>(null)
	const generationRef = useRef(0)
	const mountedRef = useRef(false)
	const onAutoSaveRef = useRef(persistence?.onAutoSave)
	const normalizedDelay = Math.max(0, delay)
	const delayRef = useRef(normalizedDelay)
	const startSaveRef = useRef(
		(
			_snapshot: string,
			_generation: number,
			_onAutoSave: NonNullable<PersistenceAdapter["onAutoSave"]>,
		) => undefined,
	)
	const scheduleSaveRef = useRef(() => undefined)

	useLayoutEffect(() => {
		editorRef.current = editor
		onAutoSaveRef.current = persistence?.onAutoSave
	}, [editor, persistence?.onAutoSave])

	const updateState = useCallback((patch: Partial<AutosaveState>) => {
		const next = { ...stateRef.current, ...patch }
		if (
			next.isDirty === stateRef.current.isDirty &&
			next.isSaving === stateRef.current.isSaving &&
			next.lastSavedAt === stateRef.current.lastSavedAt
		) {
			return
		}
		stateRef.current = next
		if (mountedRef.current) setState(next)
	}, [])

	const reconcileDirtyState = useCallback(() => {
		const currentEditor = editorRef.current
		const isDirty = currentEditor
			? currentEditor.getMarkdown() !== baselineRef.current
			: dirtyRef.current
		dirtyRef.current = isDirty
		updateState({ isDirty })
		return isDirty
	}, [updateState])

	const clearTimer = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current)
		timerRef.current = null
	}, [])

	scheduleSaveRef.current = () => {
		clearTimer()
		if (!dirtyRef.current || !onAutoSaveRef.current) return
		timerRef.current = setTimeout(() => {
			timerRef.current = null
			const currentEditor = editorRef.current
			const onAutoSave = onAutoSaveRef.current
			if (!currentEditor || !onAutoSave) return
			const snapshot = currentEditor.getMarkdown()
			if (snapshot === baselineRef.current) {
				dirtyRef.current = false
				updateState({ isDirty: false })
				return
			}
			if (activeSaveRef.current) {
				saveRequestedRef.current = true
				return
			}
			startSaveRef.current(snapshot, generationRef.current, onAutoSave)
		}, delayRef.current)
	}

	startSaveRef.current = (snapshot, generation, onAutoSave) => {
		if (activeSaveRef.current) {
			saveRequestedRef.current = true
			return
		}

		updateState({ isSaving: true })
		const promise = Promise.resolve().then(() => onAutoSave(snapshot))
		activeSaveRef.current = promise
		let succeeded = false

		void promise
			.then(
				() => {
					succeeded = true
					if (generation === generationRef.current) {
						baselineRef.current = snapshot
						updateState({ lastSavedAt: new Date() })
					}
				},
				(error: unknown) => {
					console.error("Autosave failed:", error)
				},
			)
			.then(() => {
				if (activeSaveRef.current !== promise) return
				activeSaveRef.current = null

				if (!mountedRef.current) {
					const pending = pendingUnmountSaveRef.current
					pendingUnmountSaveRef.current = null
					if (pending?.onAutoSave && pending.snapshot !== baselineRef.current) {
						startSaveRef.current(
							pending.snapshot,
							pending.generation,
							pending.onAutoSave,
						)
					}
					return
				}

				const isDirty = reconcileDirtyState()
				const shouldSaveImmediately = saveRequestedRef.current
				saveRequestedRef.current = false
				const nextOnAutoSave = onAutoSaveRef.current
				const currentEditor = editorRef.current
				if (isDirty && nextOnAutoSave && currentEditor) {
					if (shouldSaveImmediately) {
						startSaveRef.current(
							currentEditor.getMarkdown(),
							generationRef.current,
							nextOnAutoSave,
						)
					} else if (succeeded && !timerRef.current) {
						scheduleSaveRef.current()
					}
				}

				if (!activeSaveRef.current) updateState({ isSaving: false })
			})
	}

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
			clearTimer()
			const currentEditor = editorRef.current
			const snapshot = currentEditor?.getMarkdown()
			const onAutoSave = onAutoSaveRef.current
			if (snapshot === undefined || !onAutoSave) return

			if (activeSaveRef.current) {
				pendingUnmountSaveRef.current = {
					generation: generationRef.current,
					onAutoSave,
					snapshot,
				}
			} else if (snapshot !== baselineRef.current) {
				startSaveRef.current(snapshot, generationRef.current, onAutoSave)
			}
		}
	}, [clearTimer])

	useEffect(() => {
		if (!editor) return

		if (initializedEditorRef.current !== editor) {
			initializedEditorRef.current = editor
			generationRef.current += 1
			baselineRef.current = editor.getMarkdown()
			dirtyRef.current = false
			updateState({ isDirty: false, lastSavedAt: null })
		}

		const handleUpdate = () => {
			const isDirty = editor.getMarkdown() !== baselineRef.current
			dirtyRef.current = isDirty
			updateState({ isDirty })
			if (isDirty) scheduleSaveRef.current()
			else clearTimer()
		}

		editor.on("update", handleUpdate)
		return () => {
			editor.off("update", handleUpdate)
			clearTimer()
		}
	}, [clearTimer, editor, updateState])

	useEffect(() => {
		delayRef.current = normalizedDelay
		if (!persistence?.onAutoSave) clearTimer()
		else if (dirtyRef.current) scheduleSaveRef.current()
	}, [clearTimer, normalizedDelay, persistence?.onAutoSave])

	const markCurrentContentClean = useCallback(() => {
		clearTimer()
		generationRef.current += 1
		saveRequestedRef.current = false
		pendingUnmountSaveRef.current = null
		baselineRef.current = editorRef.current?.getMarkdown() ?? ""
		dirtyRef.current = false
		updateState({
			isDirty: false,
			isSaving: activeSaveRef.current !== null,
			lastSavedAt: null,
		})
	}, [clearTimer, updateState])

	const markContentSaved = useCallback(
		(markdown: string) => {
			clearTimer()
			generationRef.current += 1
			baselineRef.current = markdown
			const isDirty = editorRef.current?.getMarkdown() !== markdown
			dirtyRef.current = isDirty
			updateState({ isDirty, lastSavedAt: new Date() })
			if (isDirty) scheduleSaveRef.current()
		},
		[clearTimer, updateState],
	)

	return {
		...state,
		hasUnsavedChanges: () => dirtyRef.current,
		markContentSaved,
		markCurrentContentClean,
	}
}
