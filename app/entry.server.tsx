import { isbot } from "isbot"
import { renderToReadableStream } from "react-dom/server"
import type { EntryContext, RouterContextProvider } from "react-router"
import { ServerRouter } from "react-router"

/**
 * How long a streamed loader promise has to land before React Router abandons
 * it and rejects the slot instead. This is the bound behind ADR 0006's promise
 * that a skeleton is never permanent: past it, every still-pending section
 * renders its `errorElement`. Stated here rather than left to the framework
 * default so the number is greppable from the code that relies on it.
 *
 * It bounds what the client is sent. The render below has to be abandoned
 * separately — see the signal it is given — or a promise that never settles
 * would hold this document's stream open after the data behind it was given up
 * on, and `allReady` would never resolve for the crawlers that wait on it.
 */
export const streamTimeout = 5_000

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
	_loadContext: RouterContextProvider,
) {
	let shellRendered = false
	const userAgent = request.headers.get("user-agent")

	const body = await renderToReadableStream(
		<ServerRouter context={routerContext} url={request.url} />,
		{
			// A second past the data's own deadline: long enough that a section
			// that timed out still renders its error state into this document,
			// short enough that nothing waits on a promise that is not coming.
			signal: AbortSignal.timeout(streamTimeout + 1_000),
			onError(error: unknown) {
				responseStatusCode = 500
				// Log streaming rendering errors from inside the shell.  Don't log
				// errors encountered during initial shell rendering since they'll
				// reject and get logged in handleDocumentRequest.
				if (shellRendered) {
					console.error(error)
				}
			},
		},
	)
	shellRendered = true

	// Ensure requests from bots and SPA Mode renders wait for all content to load before responding
	// https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
	if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
		await body.allReady
	}

	responseHeaders.set("Content-Type", "text/html")
	return new Response(body, {
		headers: responseHeaders,
		status: responseStatusCode,
	})
}
