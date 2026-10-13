/**
 * Where a Project's Staged Images wait for a Commit, and where the Commit puts
 * them, as the drafts module sees it. The bucket, the Project and the URL the
 * editor serves them from are closed over by the adapter, so the module only
 * reads an image and forgets it.
 */
export interface StagedImageStore {
	/** What a Staged Image's link starts with in the Body. */
	baseUrl: string
	/** Remove images nothing can use any more. */
	delete(ids: string[]): Promise<void>
	/** Every image staged under the Project, with when it was uploaded. */
	list(): Promise<{ id: string; uploaded: Date }[]>
	/** Where a Commit writes them, as a repository path. */
	mediaPath: string
	/** What the committed Body links them by. */
	mediaUrl: string
	/** One image's bytes; null when nothing is staged under the id. */
	read(id: string): Promise<Uint8Array | null>
}
