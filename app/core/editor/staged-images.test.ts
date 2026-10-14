import { expect, test } from "vitest"
import {
	commitStagedImages,
	stagedImageBaseUrl,
	stagedImageType,
} from "./staged-images"

const BASE_URL = stagedImageBaseUrl("acme", "site")
const PNG = "0b6f1c8e-4b1a-4d8e-9f2a-3c5d7e9f1a2b.png"
const JPG = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d.jpg"

test("points every Staged Image the Body uses at its path in the media directory", () => {
	const markdown = `Intro\n\n![A cat](${BASE_URL}/${PNG})\n\n![A dog](${BASE_URL}/${JPG} "Dog")`

	expect(
		commitStagedImages(
			markdown,
			BASE_URL,
			"src/assets/images",
			"src/assets/images",
		),
	).toEqual({
		images: [
			{
				id: PNG,
				path: `src/assets/images/${PNG}`,
				src: `${BASE_URL}/${PNG}`,
				url: `src/assets/images/${PNG}`,
			},
			{
				id: JPG,
				path: `src/assets/images/${JPG}`,
				src: `${BASE_URL}/${JPG}`,
				url: `src/assets/images/${JPG}`,
			},
		],
		markdown: `Intro\n\n![A cat](src/assets/images/${PNG})\n\n![A dog](src/assets/images/${JPG} "Dog")`,
	})
})

test("names an image used twice once, and rewrites both uses", () => {
	const markdown = `![a](${BASE_URL}/${PNG})\n\n<img src="${BASE_URL}/${PNG}" />`

	const committed = commitStagedImages(markdown, BASE_URL, "media", "media")

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

	expect(commitStagedImages(markdown, BASE_URL, "media", "media")).toEqual({
		images: [],
		markdown,
	})
})

// A link copied from the browser carries the origin the image was served from.
test("points an absolute link to a Staged Image at its path too", () => {
	const markdown = `![A cat](https://app.kobun.io${BASE_URL}/${PNG})`

	expect(commitStagedImages(markdown, BASE_URL, "media", "media")).toEqual({
		images: [
			{
				id: PNG,
				path: `media/${PNG}`,
				src: `https://app.kobun.io${BASE_URL}/${PNG}`,
				url: `media/${PNG}`,
			},
		],
		markdown: `![A cat](media/${PNG})`,
	})
})

test("links each image by the media URL, and writes it to the media directory", () => {
	const markdown = `![A cat](${BASE_URL}/${PNG})`

	expect(
		commitStagedImages(markdown, BASE_URL, "public/images", "/images"),
	).toEqual({
		images: [
			{
				id: PNG,
				path: `public/images/${PNG}`,
				src: `${BASE_URL}/${PNG}`,
				url: `/images/${PNG}`,
			},
		],
		markdown: `![A cat](/images/${PNG})`,
	})
})

const bytes = (...parts: (string | number[])[]) =>
	new Uint8Array(
		parts.flatMap((part) =>
			typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
		),
	)

test.each([
	[bytes([0x89], "PNG\r\n\x1a\n"), "image/png"],
	[bytes([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
	[bytes("GIF87a"), "image/gif"],
	[bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "image/webp"],
	[bytes([0, 0, 0, 0x1c], "ftypavif"), "image/avif"],
	[
		bytes([0, 0, 0, 0x1c], "ftypmif1", [0, 0, 0, 0], "mif1miafavif"),
		"image/avif",
	],
	[bytes([0, 0, 0, 0x18], "ftypmif1", [0, 0, 0, 0], "heic"), null],
	// A brand past the end of the ftyp box belongs to the next box.
	[bytes([0, 0, 0, 0x14], "ftypmif1", [0, 0, 0, 0], "miafavif"), null],
	[bytes("<svg/>"), null],
	[bytes(), null],
])("reads the image type from the first bytes (%#)", (file, type) => {
	expect(stagedImageType(file)).toBe(type)
})
