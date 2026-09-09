/**
 * Which of the two targets the editor header's split control runs when the
 * writer presses its primary button.
 *
 * Narrower than the header's own `EditorAction`: Publish is a separate button
 * and never a primary, because it means something else entirely (ADR-0008).
 * The two values are `EditorActionIntents`' own, so this invents no third
 * vocabulary for the same pair of acts.
 *
 * Deliberately not a `.server` module, unlike `theme.server.ts`: the guard is
 * needed on both sides — the browser validates its own optimistic value with it
 * — and nothing here touches a server-only API. Where the choice is kept is
 * `userPreference`'s business (ADR-0010); this module only says what a choice is.
 */
export type PrimaryEditorAction = "save" | "commit"

/**
 * What a writer who has never opened the dropdown gets.
 *
 * Save, because a default is a decision made on somebody's behalf and this is
 * the one where being wrong costs nothing: a Draft in Kobun is private,
 * reversible, and already being written by autosave. Save to GitHub puts a
 * commit in a shared history under the writer's own GitHub identity.
 */
export const DEFAULT_PRIMARY_EDITOR_ACTION: PrimaryEditorAction = "save"

export function isPrimaryEditorAction(
	value: unknown,
): value is PrimaryEditorAction {
	return value === "save" || value === "commit"
}

/**
 * The stored value, coerced to a target the header can render.
 *
 * The column is a plain `text()` and `packages/db` has no vocabulary for this
 * pair, so nothing between the row and here says the string is one of the two.
 * Null is a writer who has never chosen — most writers — and an unrecognised
 * value is a row written by an older or a wronger Kobun; both are the default
 * rather than a throw, because neither is a reason to refuse someone their
 * editor.
 */
export function toPrimaryEditorAction(
	stored: string | null,
): PrimaryEditorAction {
	return isPrimaryEditorAction(stored) ? stored : DEFAULT_PRIMARY_EDITOR_ACTION
}
