import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import z from "zod"
import { kobunConfigSchema } from "@/config/schema"
import packageJson from "../package.json"

// Writes `<dir>/<prefix>.<hash>.json`, removes older hashed copies, and
// writes the hash to `workers/generated/<mapName>.ts` for the Worker.
function writeHashed(
	dir: string,
	prefix: string,
	mapName: string,
	constName: string,
	data: unknown,
) {
	const output = JSON.stringify(data, null, 2)
	const hash = createHash("sha256").update(output).digest("hex").slice(0, 12)

	mkdirSync(dir, { recursive: true })
	for (const file of readdirSync(dir)) {
		if (file.startsWith(`${prefix}.`) && file.endsWith(".json")) {
			rmSync(`${dir}/${file}`)
		}
	}
	writeFileSync(`${dir}/${prefix}.${hash}.json`, output)

	mkdirSync("workers/generated", { recursive: true })
	writeFileSync(
		`workers/generated/${mapName}.ts`,
		`export const ${constName} = "${hash}";\n`,
	)
}

const jsonSchema = z.toJSONSchema(kobunConfigSchema, {
	reused: "inline",
	cycles: "ref",
	target: "draft-2020-12",
})
delete (jsonSchema as Record<string, unknown>).$schema
writeHashed("public/schemas", "v1", "schema-map", "schemaHash", jsonSchema)

const version = packageJson.version
const tag = `v${version}`
const repo = "aureliushq/kobun"
writeHashed("public/manifest", "manifest", "manifest-map", "manifestHash", {
	version,
	releaseUrl: `https://github.com/${repo}/releases/tag/${tag}`,
	changelogUrl: `https://github.com/${repo}/releases/tag/${tag}`,
})
