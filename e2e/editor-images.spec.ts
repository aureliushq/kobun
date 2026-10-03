import { expect, type Page, test } from "@playwright/test"
import { E2E_NAME, E2E_OWNER, signInWriter } from "./support/signed-in-writer"

// A 1×1 PNG, so the browser has a real picture to decode once it is served.
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
)
const STAGED_SRC = new RegExp(
	`^/api/staged-image/${E2E_OWNER}/${E2E_NAME}/[0-9a-f-]+\\.png$`,
)

// A real editor route compiles and loads far more than the fixture page does.
test.describe.configure({ timeout: 30_000 })

test.beforeEach(async ({ baseURL, context, page }) => {
	await context.addCookies(await signInWriter(baseURL as string))
	await page.goto(`/${E2E_OWNER}/${E2E_NAME}/collections/posts/editor/new`)
	await expect(page.locator(".ProseMirror")).toBeVisible()
})

/** Pick a file through the `/image` slash command, as the writer does. */
async function insertThroughSlashCommand(
	page: Page,
	file: { buffer: Buffer; mimeType: string; name: string },
) {
	await page.locator(".ProseMirror").pressSequentially("/image")
	const chooser = page.waitForEvent("filechooser")
	await page.getByRole("option", { name: /Image/ }).click()
	await (await chooser).setFiles(file)
}

/** Hand the editor a file the way a paste or a drop would. */
async function dispatchFile(page: Page, kind: "drop" | "paste") {
	await page.locator(".ProseMirror").evaluate(
		(element, { bytes, kind }) => {
			const transfer = new DataTransfer()
			transfer.items.add(
				new File([new Uint8Array(bytes)], `${kind}.png`, { type: "image/png" }),
			)
			const box = element.getBoundingClientRect()
			element.dispatchEvent(
				kind === "paste"
					? new ClipboardEvent("paste", {
							bubbles: true,
							cancelable: true,
							clipboardData: transfer,
						})
					: new DragEvent("drop", {
							bubbles: true,
							cancelable: true,
							clientX: box.left + 10,
							clientY: box.top + 10,
							dataTransfer: transfer,
						}),
			)
		},
		{ bytes: [...PNG], kind },
	)
}

async function expectStaged(page: Page, alt: string) {
	const image = page.getByRole("img", { name: alt })
	await expect(image).toHaveAttribute("src", STAGED_SRC)
	await expect
		.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
		.toBe(1)
	return image.getAttribute("src")
}

test("stages an image from /image and keeps it when the Draft is reopened", async ({
	page,
}) => {
	// The save that carries the staged URL, not the one sent while it uploaded.
	const saved = page.waitForResponse(
		(response) =>
			response.url().includes("/api/editor/") &&
			(response.request().postData() ?? "").includes("/api/staged-image/") &&
			response.ok(),
	)
	await insertThroughSlashCommand(page, {
		buffer: PNG,
		mimeType: "image/png",
		name: "photo.png",
	})
	const src = await expectStaged(page, "photo.png")
	await saved
	await expect(page).toHaveURL(/[?&]draft=/)

	await page.reload()

	await expect(page.getByRole("img", { name: "photo.png" })).toHaveAttribute(
		"src",
		src as string,
	)
})

test("stages an image pasted or dropped into the editor", async ({ page }) => {
	await dispatchFile(page, "paste")
	await expectStaged(page, "paste.png")

	await dispatchFile(page, "drop")
	await expectStaged(page, "drop.png")
})

test("tells the writer why an image was refused", async ({ page }) => {
	await insertThroughSlashCommand(page, {
		buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
		mimeType: "image/svg+xml",
		name: "logo.svg",
	})

	await expect(
		page.getByText(
			"Failed to upload: Use a PNG, JPEG, GIF, WebP or AVIF image.",
		),
	).toBeVisible()
})

test("refuses an oversized image on the server, whatever the editor allowed", async ({
	page,
}) => {
	const response = await page.request.post(
		`/api/staged-image/${E2E_OWNER}/${E2E_NAME}`,
		{
			multipart: {
				file: {
					buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
					mimeType: "image/png",
					name: "huge.png",
				},
			},
		},
	)

	expect(response.status()).toBe(413)
	expect(await response.json()).toEqual({
		error: "Images can be at most 5 MB.",
	})
})
