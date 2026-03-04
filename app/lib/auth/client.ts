import { createAuthClient } from "better-auth/react";

let auth: ReturnType<typeof createAuthClient>;

export function getAuthClient({ baseURL }: { baseURL: string }) {
	if (!auth) {
		auth = createAuthClient({
			baseURL,
		});
	}

	return auth;
}
