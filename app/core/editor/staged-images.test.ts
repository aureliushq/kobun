import { expect, test } from "vitest"
import { commitStagedImages, stagedImageBaseUrl } from "./staged-images"

const BASE_URL = stagedImageBaseUrl("acme", "site")
const PNG = "0b6f1c8e-4b1a-4d8e-9f2a-3c5d7e9f1a2b.png"
const JPG = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg"

test("points every Staged Image the Body uses at its path in the media directory", () => {
	const markdown = `Intro\n\n![A cat](${BASE_URL}/${PNG})\n\n![A dog](${BASE_URL}/${JPG} "Dog")`

	expect(commitStagedImages(markdown, BASE_URL, "src/assets/images")).toEqual({
		images: [
			{ id: PNG, path: `src/assets/images/${PNG}`, src: `${BASE_URL}/${PNG}` },
			{ id: JPG, path: `src/assets/images/${JPG}`, src: `${BASE_URL}/${JPG}` },
		],
		markdown: `Intro\n\n![A cat](src/assets/images/${PNG})\n\n![A dog](src/assets/images/${JPG} "Dog")`,
	})
})

test("names an image used twice once, and rewrites both uses", () => {
	const markdown = `![a](${BASE_URL}/${PNG})\n\n<img src="${BASE_URL}/${PNG}" />`

	const committed = commitStagedImages(markdown, BASE_URL, "media")

	expect(committed.images).toHaveLength(1)
	expect(committed.markdown).toBe(
		`![a](media/${PNG})\n\n<img src="media/${PNG}" />`,
	)
})

test("leaves links that are not this Project's Staged Images alone", () => {
	const markdown = [
		`![other](${stagedImageBaseUrl("acme", "other")}/${PNG})`,
		"![repo](src/assets/images/old.png)",
		"![web](https://example.com/cat.png)",
	].join("\n\n")

	expect(commitStagedImages(markdown, BASE_URL, "media")).toEqual({
		images: [],
		markdown,
	})
})
