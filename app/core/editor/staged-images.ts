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

/** Where a Project's Staged Images are uploaded to and served from. */
export function stagedImageBaseUrl(owner: string, name: string) {
	return `/api/staged-image/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
}
