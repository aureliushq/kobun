import { createHash } from "node:crypto"
import { readdirSync, rmSync } from "node:fs"
import z from "zod"
import { kobunConfigSchema } from "@/config/schema"

const jsonSchema = z.toJSONSchema(kobunConfigSchema, {
	reused: "inline",
	cycles: "ref",
	target: "draft-2020-12",
})

delete (jsonSchema as Record<string, unknown>).$schema

const output = JSON.stringify(jsonSchema, null, 2)

const hash = createHash("sha256").update(output).digest("hex").slice(0, 12)

// Remove old hashed schema files
for (const file of readdirSync("public/schemas")) {
	if (file.startsWith("v1.") && file.endsWith(".json")) {
		rmSync(`public/schemas/${file}`)
	}
}

// Write hashed schema file
await Bun.write(`public/schemas/v1.${hash}.json`, output)

// Write hash mapping for the Worker
await Bun.write(
	"workers/generated/schema-map.ts",
	`export const schemaHash = "${hash}";\n`,
)
