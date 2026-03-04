import { data } from "react-router";
import type { Theme } from "~/lib/theme.server";
import { serializeThemeCookie } from "~/lib/theme.server";
import type { Route } from "./+types/api.set-theme";

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const theme = formData.get("theme") as Theme;

	if (!theme || !["light", "dark", "system"].includes(theme)) {
		return data({ success: false }, { status: 400 });
	}

	return data(
		{ success: true },
		{
			headers: {
				"Set-Cookie": serializeThemeCookie(theme),
			},
		},
	);
}
