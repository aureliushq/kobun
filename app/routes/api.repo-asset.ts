import { and, eq } from "drizzle-orm"
import type { LoaderFunctionArgs } from "react-router"
import invariant from "tiny-invariant"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema/app-schema"
import { getGithubFileContent } from "@/github/octokit.server"

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

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) {
		return new Response("Unauthorized", { status: 401 })
	}

	const { owner, name } = params
	const splat = params["*"] ?? ""
	invariant(owner && name, "owner and name are required")
	if (!splat) {
		return new Response("Not Found", { status: 404 })
	}

	// Verify the user actually owns this project — prevents using our
	// installation token to fetch arbitrary files from any repo the app
	// happens to be installed on.
	const projectRow = await db.query.project.findFirst({
		where: and(
			eq(project.userId, session.user.id),
			eq(project.repoOwnerLogin, owner),
			eq(project.repoName, name),
		),
		with: { githubInstallation: true },
	})
	if (!projectRow) {
		return new Response("Not Found", { status: 404 })
	}

	const installationId = projectRow.githubInstallation.githubInstallationId
	const filePath = decodeURIComponent(splat).replace(/^\/+/, "")

	let file: Awaited<ReturnType<typeof getGithubFileContent>>
	try {
		file = await getGithubFileContent(
			env,
			installationId,
			owner,
			name,
			filePath,
		)
	} catch (error) {
		if (
			error instanceof Error &&
			"status" in error &&
			(error as { status?: number }).status === 404
		) {
			return new Response("Not Found", { status: 404 })
		}
		throw error
	}

	const etag = `"${file.sha}"`
	const cacheControl = "private, max-age=60, must-revalidate"

	const ifNoneMatch = request.headers.get("If-None-Match")
	if (ifNoneMatch === etag) {
		return new Response(null, {
			status: 304,
			headers: {
				ETag: etag,
				"Cache-Control": cacheControl,
			},
		})
	}

	// `file.content` is a binary string (atob output): each char's code
	// point is the byte value. Convert to a Uint8Array for the Response body.
	const bin = file.content
	const bytes = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

	return new Response(bytes, {
		headers: {
			"Content-Type": guessContentType(filePath),
			"Cache-Control": cacheControl,
			ETag: etag,
		},
	})
}
