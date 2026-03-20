import z from "zod"
import { kobunConfigSchema } from "@/config/schema"

const jsonSchema = z.toJSONSchema(kobunConfigSchema, {
	reused: "inline",
	cycles: "ref",
	target: "draft-2020-12",
})

delete (jsonSchema as Record<string, unknown>).$schema

const output = JSON.stringify(jsonSchema, null, 2)
await Bun.write("public/schemas/v1.json", output)
