import { drizzle } from "drizzle-orm/d1"
import { createRequestHandler, RouterContextProvider } from "react-router"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import * as schema from "@/db/schema"
import { schemaHash } from "./generated/schema-map"

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
)

export default {
	async fetch(request, env) {
		const url = new URL(request.url)

		if (url.pathname === "/schemas/v1.json") {
			return Response.redirect(
				`${url.origin}/schemas/v1.${schemaHash}.json`,
				302,
			)
		}

		const db = drizzle(env.DB, { schema, casing: "snake_case" })

		const context = new RouterContextProvider()
		context.set(dbContext, db)
		context.set(envContext, env)

		return requestHandler(request, context)
	},
} satisfies ExportedHandler<Env>
