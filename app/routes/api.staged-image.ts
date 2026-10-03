import {
	checkStagedImage,
	STAGED_IMAGE_TYPES,
	stagedImageBaseUrl,
} from "@/core/editor/staged-images"
import { requireApiAccess } from "@/core/project-context/project-context.server"
import type { Route } from "./+types/api.staged-image"

function refuse(status: number, error: string) {
	return Response.json({ error }, { status })
}

/**
 * Stage an image the writer added in the editor. It is held in R2 under the
 * Project until a Commit writes it to the repository; the Draft refers to it
 * only through the URL answered here, which its Markdown carries.
 */
export async function action({ context, params, request }: Route.ActionArgs) {
	const { env, name, owner, projectRow } = await requireApiAccess({
		context,
		params,
		request,
	})

	const file = (await request.formData()).get("file")
	if (!(file instanceof File)) return refuse(400, "No image was sent.")

	// The editor checks this first, but a request need not come from it.
	const refusal = checkStagedImage(file)
	if (refusal) return refuse(refusal.status, refusal.error)

	const imageId = `${crypto.randomUUID()}.${STAGED_IMAGE_TYPES.get(file.type)}`
	// R2 refuses a stream whose length it cannot know, and the size is capped.
	await env.IMAGES.put(
		`${projectRow.id}/${imageId}`,
		await file.arrayBuffer(),
		{
			httpMetadata: { contentType: file.type },
		},
	)

	return Response.json({ src: `${stagedImageBaseUrl(owner, name)}/${imageId}` })
}

/**
 * Serve a Staged Image to a writer of its Project. The key is built from the
 * Project the session resolved, so an id from another Project is not found.
 */
export async function loader({ context, params, request }: Route.LoaderArgs) {
	const { env, projectRow } = await requireApiAccess({
		context,
		params,
		request,
	})

	const object = params.image_id
		? await env.IMAGES.get(`${projectRow.id}/${params.image_id}`)
		: null
	if (!object) return new Response("Not Found", { status: 404 })

	return new Response(object.body, {
		headers: {
			// An id names one upload forever, so a copy never goes stale.
			"Cache-Control": "private, max-age=31536000, immutable",
			"Content-Type":
				object.httpMetadata?.contentType ?? "application/octet-stream",
			ETag: object.httpEtag,
			"X-Content-Type-Options": "nosniff",
		},
	})
}
