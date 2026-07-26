import { Autosend } from "autosendjs"

export function getAutosend(env: Env) {
	const autosend = new Autosend(env.AUTOSEND_API_KEY as string, {
		baseUrl: "https://api.autosend.com/v1",
		timeout: 30000,
		maxRetries: 3,
		debug: false,
	})

	return autosend
}
