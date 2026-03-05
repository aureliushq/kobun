import { createRequestHandler } from "react-router";
import { type AppDatabase, getDB } from "~/lib/database/db.server";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
		db: AppDatabase;
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	async fetch(request, env, ctx) {
		const db = getDB(env.DB);
		return requestHandler(request, {
			cloudflare: { env, ctx },
			db,
		});
	},
} satisfies ExportedHandler<Env>;
