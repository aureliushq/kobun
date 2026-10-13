import { stagedImageBaseUrl, stagedImageKey } from "@/core/editor/staged-images"
import type { StagedImageStore } from "./staged-image-store"

/**
 * A Project's Staged Images in R2, as a `StagedImageStore`. Keyed the way the
 * upload route stages them, under the Project, so an id from another Project
 * reads as nothing.
 */
export function createR2StagedImageStore(context: {
	bucket: R2Bucket
	mediaPath: string
	mediaUrl: string
	name: string
	owner: string
	projectId: string
}): StagedImageStore {
	const { bucket, mediaPath, mediaUrl, name, owner, projectId } = context
	const key = (id: string) => stagedImageKey(projectId, id)

	return {
		baseUrl: stagedImageBaseUrl(owner, name),
		delete: (ids) => bucket.delete(ids.map(key)),
		list: async () => {
			const prefix = key("")
			const images = []
			let cursor: string | undefined
			do {
				const page = await bucket.list({ cursor, prefix })
				for (const object of page.objects) {
					images.push({
						id: object.key.slice(prefix.length),
						uploaded: object.uploaded,
					})
				}
				cursor = page.truncated ? page.cursor : undefined
			} while (cursor)
			return images
		},
		read: async (id) => {
			const object = await bucket.get(key(id))
			return object ? new Uint8Array(await object.arrayBuffer()) : null
		},
		mediaPath,
		mediaUrl,
	}
}

/**
 * Forget every image staged under a Project, once the Project is gone and no
 * Draft is left to link one. Each pass lists from the start and deletes what it
 * finds, at most the 1000 keys a delete takes, so no cursor has to outlive a
 * delete.
 */
export async function removeProjectStagedImages(
	bucket: R2Bucket,
	projectId: string,
): Promise<void> {
	const prefix = stagedImageKey(projectId, "")
	for (;;) {
		const { objects } = await bucket.list({ prefix })
		if (!objects.length) return
		await bucket.delete(objects.map(({ key }) => key))
	}
}
