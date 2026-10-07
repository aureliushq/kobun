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

/** A Staged Image a Commit writes, and the repository path it is written to. */
export interface CommittedImage {
	id: string
	path: string
	src: string
}

/**
 * The Body as it is committed: each Staged Image it still uses points at its
 * path in the media directory, and those images are named so the Commit can
 * write them. An image the writer removed is not in the Body, so it is not
 * named and never reaches the repository.
 */
export function commitStagedImages(
	markdown: string,
	baseUrl: string,
	mediaPath: string,
): { images: CommittedImage[]; markdown: string } {
	const extensions = [...new Set(STAGED_IMAGE_TYPES.values())].join("|")
	const pattern = new RegExp(
		// A link copied out of the browser carries the origin it was served from.
		`(?:https?://[^/\\s"'()]+)?${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([0-9a-f-]{36}\\.(?:${extensions}))`,
		"g",
	)
	const images = new Map<string, CommittedImage>()
	const committed = markdown.replace(pattern, (src, id: string) => {
		const path = `${mediaPath}/${id}`
		images.set(id, { id, path, src })
		return path
	})
	return { images: [...images.values()], markdown: committed }
}
