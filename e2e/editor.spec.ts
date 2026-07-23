import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
	await page.goto("/component-examples?editor-e2e")
	await expect(page.locator(".ProseMirror")).toBeVisible()
})

test("applies Markdown shortcuts", async ({ page }) => {
	const editor = page.locator(".ProseMirror")

	await editor.pressSequentially("# Heading ")
	await expect(editor.locator("h1")).toHaveText("Heading")

	await editor.press("Enter")
	await editor.pressSequentially("**bold** ")
	await expect(editor.locator("strong")).toHaveText("bold")

	await editor.press("Enter")
	await editor.pressSequentially("- item ")
	await expect(editor.locator("li")).toHaveText("item")

	await editor.press("Enter")
	await editor.press("Enter")
	await editor.pressSequentially("> quote ")
	await expect(editor.locator("blockquote")).toContainText("quote")
})

test("runs a filtered slash command", async ({ page }) => {
	const editor = page.locator(".ProseMirror")
	await editor.pressSequentially("/head")
	await page.getByText("Heading 1", { exact: true }).click()
	await editor.pressSequentially("Section")

	await expect(editor.locator("h1")).toHaveText("Section")
})

test("pastes rich Markdown and copies Markdown text", async ({ page }) => {
	const editor = page.locator(".ProseMirror")
	await editor.evaluate((element) => {
		const transfer = new DataTransfer()
		transfer.setData("text/plain", "## Pasted\n\nA **bold** paragraph.")
		element.dispatchEvent(
			new ClipboardEvent("paste", {
				bubbles: true,
				cancelable: true,
				clipboardData: transfer,
			}),
		)
	})

	await expect(editor.locator("h2")).toHaveText("Pasted")
	await expect(editor.locator("strong")).toHaveText("bold")

	await editor.press("ControlOrMeta+a")
	const copied = await editor.evaluate((element) => {
		const transfer = new DataTransfer()
		element.dispatchEvent(
			new ClipboardEvent("copy", {
				bubbles: true,
				cancelable: true,
				clipboardData: transfer,
			}),
		)
		return transfer.getData("text/plain")
	})
	expect(copied).toBe("## Pasted\n\nA **bold** paragraph.")
})

test("uploads an image through the slash command adapter", async ({ page }) => {
	const editor = page.locator(".ProseMirror")
	await editor.pressSequentially("/image")

	const fileChooserPromise = page.waitForEvent("filechooser")
	await page.getByText("Image", { exact: true }).click()
	const fileChooser = await fileChooserPromise
	await fileChooser.setFiles({
		name: "photo.png",
		mimeType: "image/png",
		buffer: Buffer.from("image"),
	})

	await expect(
		page.getByRole("status", { name: "Uploading image" }),
	).toBeVisible()
	await expect(editor.locator('img[src="/mock-upload.png"]')).toBeVisible()
	await expect(page.getByTestId("markdown")).toContainText(
		"![photo.png](/mock-upload.png)",
	)
})
