import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "../db/schema"
import { getAutosend } from "../marketing/autosend.server"

function createAuth(env: Env) {
	const db = drizzle(env.DB, { schema, casing: "snake_case" })
	return betterAuth({
		appName: "Kobun",

		baseURL: env.BETTER_AUTH_URL,

		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema,
		}),

		secret: env.BETTER_AUTH_SECRET as string,

		socialProviders:
			env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
				? {
						github: {
							clientId: env.GITHUB_CLIENT_ID as string,
							clientSecret: env.GITHUB_CLIENT_SECRET as string,
						},
					}
				: undefined,

		databaseHooks: {
			user: {
				create: {
					// Fires once, only when a brand-new user is created (returning
					// logins just open a session). Add the new signup to our AutoSend
					// contact list so they're enrolled in email automations.
					after: async (user) => {
						try {
							const [firstName, ...rest] = (user.name ?? "").trim().split(/\s+/)
							await getAutosend(env).contacts.upsert({
								email: user.email,
								userId: user.id,
								firstName: firstName || undefined,
								lastName: rest.length ? rest.join(" ") : undefined,
								listIds: env.AUTOSEND_LIST_ID
									? [env.AUTOSEND_LIST_ID]
									: undefined,
							})
						} catch (error) {
							// Fail open: never block signup if AutoSend is unavailable.
							console.error("AutoSend: failed to add signup to list", error)
						}
					},
				},
			},
		},
	})
}

/**
 * One instance per environment. A request reads the session more than once
 * (the PostHog middleware, then the Project Context), and building Better Auth
 * is the expensive part, not the read. Sharing it is safe: every `auth.api`
 * call runs on its own copy of the context. Keyed weakly on `env`, so an
 * environment that goes away takes its instance with it.
 */
const instances = new WeakMap<Env, ReturnType<typeof createAuth>>()

export function getAuth(env: Env) {
	let auth = instances.get(env)
	if (!auth) {
		auth = createAuth(env)
		instances.set(env, auth)
	}
	return auth
}

// WARNING: ONLY USE THIS WHEN RUNNING BETTER AUTH CLI. USE getAuth FOR AUTH.
// Default export named `auth` for the Better Auth CLI
export const auth = getAuth({} as Env)
