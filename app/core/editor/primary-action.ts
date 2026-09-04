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
 * — and nothing here touches a server-only API.
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

const COOKIE_NAME = "editor-primary-action"

export function isPrimaryEditorAction(
	value: unknown,
): value is PrimaryEditorAction {
	return value === "save" || value === "commit"
}

export function getPrimaryEditorActionFromRequest(
	request: Request,
): PrimaryEditorAction {
	const cookieHeader = request.headers.get("Cookie") ?? ""
	const match = cookieHeader.match(
		new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
	)
	const value = match?.[1]
	return isPrimaryEditorAction(value) ? value : DEFAULT_PRIMARY_EDITOR_ACTION
}

/**
 * A year, so the choice outlives the session it was made in — surviving a
 * reload and a move to another Collection Item is the point of storing it.
 */
export function serializePrimaryEditorActionCookie(
	action: PrimaryEditorAction,
): string {
	return `${COOKIE_NAME}=${action}; Path=/; SameSite=Lax; Max-Age=31536000`
}
