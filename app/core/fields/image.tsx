import { InlineText } from "./presentation"
import type { FieldTypeDefFor } from "./types"

/**
 * A repository path is served through kobun's asset route rather than linked
 * directly: the repository may be private, so the browser cannot fetch the file
 * itself. An absolute URL is already somebody else's to serve.
 */
function imageSrc(raw: string, owner: string, name: string) {
	if (/^(https?:|data:)/i.test(raw)) return raw
	const segments = raw
		.replace(/^\/+/, "")
		.split("/")
		.map(encodeURIComponent)
		.join("/")
	return `/api/repo-asset/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${segments}`
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
