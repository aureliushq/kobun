import { InlineText, TextControl } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * A repository path is served through kobun's asset route rather than linked
 * directly: the repository may be private, so the browser cannot fetch the file
 * itself. An absolute URL is already somebody else's to serve.
 */
function imageSrc(raw: string, owner: string, name: string) {
	if (/^(https?:|data:)/i.test(raw)) return raw
	return `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${encodeSegments(raw)}`
}

/** A repository path as one URL path: every segment encoded, none of them lost. */
function encodeSegments(raw: string) {
	return raw.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")
}

/**
 * A path to an image in the Project's repository. Held as text and validated as
 * text: whether the path resolves is a question about the repo, not the value.
 *
 * A panel has room for the picture and the path beneath it. A one-line summary
 * has room for neither, so it carries the file name — the part of the path a
 * writer picked and the only part that tells two rows apart.
 */
export const imageField: FieldTypeDefFor<"image"> = {
	defaultValue: () => "",
	// The path is typed, not picked — there is no browser for the repository
	// yet. The preview underneath is what tells the writer they typed it right.
	renderControl: ({ assetBaseUrl, disabled, onChange, value }) => (
		<>
			<TextControl disabled={disabled} onChange={onChange} value={value} />
			{value ? (
				<img
					className="mt-2 max-h-40 rounded-md border object-contain"
					src={previewSrc(String(value), assetBaseUrl)}
					alt="Preview"
				/>
			) : null}
		</>
	),
	renderInline: ({ value }) => {
		const raw = String(value)
		return (
			<InlineText>{raw.split("/").filter(Boolean).pop() ?? raw}</InlineText>
		)
	},
	renderValue: ({ ctx, value }) => {
		const raw = String(value)
		return (
			<div className="flex flex-col gap-2">
				<img
					src={imageSrc(raw, ctx.owner, ctx.name)}
					alt=""
					className="max-h-64 max-w-md rounded border object-contain"
				/>
				<span className="break-all font-mono text-muted-foreground text-xs">
					{raw}
				</span>
			</div>
		)
	},
	validate: ({ path, value }) =>
		typeof value === "string" ? [] : [`${path} must be text`],
}

/**
 * The preview's source. Deliberately not `imageSrc`: that one is handed the
 * Project and builds the asset route itself, while the editor already has the
 * route built and passes it in. The two also disagree on purpose about a
 * root-relative path — the editor leaves one alone, because a writer who typed
 * a leading slash meant a path on this site, not in the repository.
 */
function previewSrc(raw: string, assetBaseUrl?: string) {
	if (/^(https?:|data:|\/)/i.test(raw) || !assetBaseUrl) return raw
	return `${assetBaseUrl}/${encodeSegments(raw)}`
}
