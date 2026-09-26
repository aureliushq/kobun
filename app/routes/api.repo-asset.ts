import { requireApiAccess } from "@/core/project-context/project-context.server"
import {
	getGithubFileBytes,
	getGithubFileSha,
	hasStatus,
} from "@/github/octokit.server"
import type { Route } from "./+types/api.repo-asset"

const CONTENT_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	avif: "image/avif",
	ico: "image/x-icon",
	bmp: "image/bmp",
	tif: "image/tiff",
	tiff: "image/tiff",
}

function guessContentType(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? ""
	return CONTENT_TYPES[ext] ?? "application/octet-stream"
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
	// Resolved without the Config: the seam answers whether this user may read
	// this repository — which is what stops our installation token fetching
	// files from every repository the app happens to be installed on — and the
	// picture is served without ever asking what the repository declares.
	const { env, installationId, name, owner } = await requireApiAccess({
		context,
		params,
		request,
	})

	const splat = params["*"]
	if (!splat) {
		return new Response("Not Found", { status: 404 })
	}
	const filePath = decodeURIComponent(splat).replace(/^\/+/, "")

	const cacheControl = "private, max-age=60, must-revalidate"
	const notFound = () => new Response("Not Found", { status: 404 })

	// A browser holding a copy asks for the sha alone first: an unchanged
	// picture is answered without downloading it, which is what every
	// revalidation after `max-age` would otherwise cost.
	const ifNoneMatch = request.headers.get("If-None-Match")
	if (ifNoneMatch) {
		const sha = await getGithubFileSha(
			env,
			installationId,
			owner,
			name,
			filePath,
		)
		if (!sha) return notFound()
		if (ifNoneMatch === `"${sha}"`) {
			return new Response(null, {
				status: 304,
				headers: { ETag: ifNoneMatch, "Cache-Control": cacheControl },
			})
		}
	}

	let file: Awaited<ReturnType<typeof getGithubFileBytes>>
	try {
		file = await getGithubFileBytes(env, installationId, owner, name, filePath)
	} catch (error) {
		if (hasStatus(error, 404)) return notFound()
		throw error
	}

	return new Response(file.bytes, {
		headers: {
			"Content-Type": guessContentType(filePath),
			"Cache-Control": cacheControl,
			ETag: `"${file.sha}"`,
		},
	})
}
