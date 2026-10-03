/**
 * Where a Project's Staged Images wait for a Commit, as the drafts module sees
 * it. The bucket, the Project and the URL the editor serves them from are closed
 * over by the adapter, so the module only reads an image and forgets it.
 */
export interface StagedImageStore {
	/** What a Staged Image's link starts with in the Body. */
	baseUrl: string
	/** Remove images a Commit has written to the repository. */
	delete(ids: string[]): Promise<void>
	/** One image's bytes; null when nothing is staged under the id. */
	read(id: string): Promise<Uint8Array | null>
}
