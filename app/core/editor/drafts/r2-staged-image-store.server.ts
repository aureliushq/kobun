import { stagedImageBaseUrl, stagedImageKey } from "@/core/editor/staged-images"
import type { StagedImageStore } from "./staged-image-store"

/**
 * A Project's Staged Images in R2, as a `StagedImageStore`. Keyed the way the
 * upload route stages them, under the Project, so an id from another Project
 * reads as nothing.
 */
export function createR2StagedImageStore(context: {
	bucket: R2Bucket
	name: string
	owner: string
	projectId: string
}): StagedImageStore {
	const { bucket, name, owner, projectId } = context
	const key = (id: string) => stagedImageKey(projectId, id)

	return {
		baseUrl: stagedImageBaseUrl(owner, name),
		delete: (ids) => bucket.delete(ids.map(key)),
		read: async (id) => {
			const object = await bucket.get(key(id))
			return object ? new Uint8Array(await object.arrayBuffer()) : null
		},
	}
}
