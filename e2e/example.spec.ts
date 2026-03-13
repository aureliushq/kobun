import { expect, test } from "@playwright/test"

test("has content", async ({ page }) => {
	await page.goto("/login")
	await expect(page.getByText("Sign In")).toBeVisible()
})
