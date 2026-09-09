import { expect, test } from "@playwright/test"

// `/settings` is authenticated like every other page, and it is the first one
// with no Project in its URL to be refused on behalf of (#134).
test("sends a signed-out visitor to login", async ({ page }) => {
	await page.goto("/settings")
	await expect(page).toHaveURL(/\/login$/)
	await expect(page.getByText("Sign In")).toBeVisible()
})

// The Project settings page is Project-scoped, but it is refused for the same
// reason and in the same place (#136).
test("sends a signed-out visitor away from a Project's settings too", async ({
	page,
}) => {
	await page.goto("/acme/blog/settings")
	await expect(page).toHaveURL(/\/login$/)
})
