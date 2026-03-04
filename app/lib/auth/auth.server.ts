import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { getDB } from "../database/db.server";
import * as schema from "../database/schema";

export function getAuth(env: Env): ReturnType<typeof betterAuth> {
	const db = getDB(env.DB);
	// @ts-expect-error: it's fine
	return betterAuth({
		appName: "Kobun",

		baseURL: env.BETTER_AUTH_URL,

		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema,
		}),

		secret: env.BETTER_AUTH_SECRET,

		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
			},
		},

		// trustedOrigins: ["http://localhost:5173"],
	});
}

// WARNING: ONLY USE THIS WHEN RUNNING BETTER AUTH CLI. USE getAuth FOR AUTH.
// Default export named `auth` for the Better Auth CLI
export const auth = getAuth({
	// For CLI `generate` we *do not* need a real DB.
	// So we can pass a dummy object casted as Env.
	// The CLI only inspects config & plugins—not the actual DB connection.
} as Env);
