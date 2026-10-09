/**
 * What the editor may stage, and the extension each type is stored under. The
 * upload route enforces this and the editor checks it first, so both read it
 * from here. SVG is left out: served from our origin, it can run script.
 */
export const STAGED_IMAGE_TYPES = new Map([
	["image/avif", "avif"],
	["image/gif", "gif"],
	["image/jpeg", "jpg"],
	["image/png", "png"],
	["image/webp", "webp"],
])

export const STAGED_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/**
 * Why a file cannot be staged, with the status the upload route answers it
 * with, or null when it can. The editor shows the same words before sending.
 */
export function checkStagedImage(file: Pick<File, "size" | "type">) {
	if (!STAGED_IMAGE_TYPES.has(file.type)) {
		return { error: "Use a PNG, JPEG, GIF, WebP or AVIF image.", status: 415 }
	}
	if (file.size > STAGED_IMAGE_MAX_BYTES) {
		const megabytes = STAGED_IMAGE_MAX_BYTES / 1024 / 1024
		return { error: `Images can be at most ${megabytes} MB.`, status: 413 }
	}
	return null
}

/**
 * Where a Staged Image is held in R2: under its Project, so an id from another
 * Project is not found.
 */
export function stagedImageKey(projectId: string, imageId: string) {
	return `${projectId}/${imageId}`
}

/** Where a Project's Staged Images are uploaded to and served from. */
export function stagedImageBaseUrl(owner: string, name: string) {
	return `/api/staged-image/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
}

/**
 * A Staged Image a Commit writes, the repository path it is written to, and the
 * URL the Body links it by.
 */
export interface CommittedImage {
	id: string
	path: string
	src: string
	url: string
}

/**
 * The Body as it is committed: each Staged Image it still uses points at the
 * URL the site serves it from, and those images are named, with their path in
 * the media directory, so the Commit can write them. An image the writer removed is not in the Body, so it is not
 * named and never reaches the repository.
 */
export function commitStagedImages(
	markdown: string,
	baseUrl: string,
	mediaPath: string,
	mediaUrl: string,
): { images: CommittedImage[]; markdown: string } {
	const extensions = [...new Set(STAGED_IMAGE_TYPES.values())].join("|")
	const pattern = new RegExp(
		// A link copied out of the browser carries the origin it was served from.
		`(?:https?://[^/\\s"'()]+)?${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([0-9a-f-]{36}\\.(?:${extensions}))`,
		"g",
	)
	const images = new Map<string, CommittedImage>()
	const committed = markdown.replace(pattern, (src, id: string) => {
		const url = `${mediaUrl}/${id}`
		images.set(id, { id, path: `${mediaPath}/${id}`, src, url })
		return url
	})
	return { images: [...images.values()], markdown: committed }
}
