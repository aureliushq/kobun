import { defineConfig } from "drizzle-kit"
import { getDbCredentials } from "@/db/utils"

const command = process.argv[1]?.includes("drizzle-kit")
	? process.argv[2]
	: undefined
const needsDb = !command || !["generate", "check"].includes(command)

export default defineConfig({
	dialect: "sqlite",
	schema: "./packages/db/schema.ts",
	out: "./packages/db/migrations",
	...(needsDb ? getDbCredentials() : {}),
})
