import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, rmSync } from "node:fs"
import packageJson from "../package.json"

const version = packageJson.version
const tag = `v${version}`
const repo = "aureliushq/kobun"

const manifest = {
	version,
	releaseUrl: `https://github.com/${repo}/releases/tag/${tag}`,
	changelogUrl: `https://github.com/${repo}/releases/tag/${tag}`,
}

const output = JSON.stringify(manifest, null, 2)

const hash = createHash("sha256").update(output).digest("hex").slice(0, 12)

// Remove old hashed manifest files
mkdirSync("public/manifest", { recursive: true })
for (const file of readdirSync("public/manifest")) {
	if (file.startsWith("manifest.") && file.endsWith(".json")) {
		rmSync(`public/manifest/${file}`)
	}
}

// Write hashed manifest file
await Bun.write(`public/manifest/manifest.${hash}.json`, output)

// Write hash mapping for the Worker
mkdirSync("workers/generated", { recursive: true })
await Bun.write(
	"workers/generated/manifest-map.ts",
	`export const manifestHash = "${hash}";\n`,
)
