import { beforeEach, expect, test, vi } from "vitest"
import { STAGED_IMAGE_MAX_BYTES } from "@/core/editor/staged-images"
import { action, loader } from "./api.staged-image"

/** R2, as far as the route uses it: bytes and a content type under a key. */
function createFakeBucket() {
	const objects = new Map<string, { bytes: ArrayBuffer; contentType: string }>()
	return {
		objects,
		get: async (key: string) => {
			const object = objects.get(key)
			if (!object) return null
			return {
				body: new Response(object.bytes).body,
				httpEtag: `"etag-${key}"`,
				httpMetadata: { contentType: object.contentType },
			}
		},
		put: async (
			key: string,
			bytes: ArrayBuffer,
			options: { httpMetadata: { contentType: string } },
		) => {
			objects.set(key, {
				bytes,
				contentType: options.httpMetadata.contentType,
			})
		},
	}
}

let bucket = createFakeBucket()

vi.mock("@/core/project-context/project-context.server", () => ({
	requireApiAccess: async () => ({
		env: { IMAGES: bucket },
		name: "site",
		owner: "acme",
		projectRow: { id: "project-1" },
	}),
}))

beforeEach(() => {
	bucket = createFakeBucket()
})

function upload(file?: File) {
	const body = new FormData()
	if (file) body.set("file", file)
	return action({
		params: { name: "site", owner: "acme" },
		request: new Request("http://localhost/api/staged-image/acme/site", {
			body,
			method: "POST",
		}),
	} as unknown as Parameters<typeof action>[0]) as Promise<Response>
}

function load(imageId: string) {
	return loader({
		params: { image_id: imageId, name: "site", owner: "acme" },
		request: new Request(
			`http://localhost/api/staged-image/acme/site/${imageId}`,
		),
	} as unknown as Parameters<typeof loader>[0]) as Promise<Response>
}

function png(size = 4) {
	return new File([new Uint8Array(size)], "photo.png", { type: "image/png" })
}

test("stages an image under the project and answers the URL it is served from", async () => {
	const response = await upload(png())

	expect(response.status).toBe(200)
	const { src } = (await response.json()) as { src: string }
	expect(src).toMatch(/^\/api\/staged-image\/acme\/site\/[0-9a-f-]+\.png$/)
	const [key] = bucket.objects.keys()
	expect(key).toBe(`project-1/${src.split("/").pop()}`)
	expect(bucket.objects.get(key)?.contentType).toBe("image/png")
})

test("serves a staged image back with its content type", async () => {
	const { src } = (await (await upload(png())).json()) as { src: string }

	const response = await load(src.split("/").pop() as string)

	expect(response.status).toBe(200)
	expect(response.headers.get("Content-Type")).toBe("image/png")
	expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
	expect((await response.arrayBuffer()).byteLength).toBe(4)
})

test("answers 404 for an image the project does not hold", async () => {
	bucket.objects.set("project-2/other.png", {
		bytes: new ArrayBuffer(1),
		contentType: "image/png",
	})

	expect((await load("other.png")).status).toBe(404)
})

test("refuses a request with no file", async () => {
	const response = await upload()

	expect(response.status).toBe(400)
	expect(await response.json()).toEqual({ error: expect.any(String) })
})

test("refuses a type it will not serve, whatever the editor allowed", async () => {
	const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })

	const response = await upload(svg)

	expect(response.status).toBe(415)
	expect(await response.json()).toEqual({ error: expect.any(String) })
	expect(bucket.objects.size).toBe(0)
})

test("refuses an image over the size limit", async () => {
	const response = await upload(png(STAGED_IMAGE_MAX_BYTES + 1))

	expect(response.status).toBe(413)
	expect(await response.json()).toEqual({ error: expect.any(String) })
	expect(bucket.objects.size).toBe(0)
})
