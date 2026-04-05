import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "../db/schema"

export function getAuth(env: Env) {
	const db = drizzle(env.DB, { schema, casing: "snake_case" })
	return betterAuth({
		appName: "Kobun",

		baseURL: env.BETTER_AUTH_URL,

		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema,
		}),

		secret: env.BETTER_AUTH_SECRET!,

		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID!,
				clientSecret: env.GITHUB_CLIENT_SECRET!,
			},
		},
	})
}

// WARNING: ONLY USE THIS WHEN RUNNING BETTER AUTH CLI. USE getAuth FOR AUTH.
// Default export named `auth` for the Better Auth CLI
export const auth = getAuth({} as Env)
