import { usePostHog } from "@posthog/react"
import { AlertCircleIcon } from "lucide-react"
import { useEffect } from "react"
import { useAsyncError } from "react-router"

import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"

/**
 * Where a streamed section goes when its data never arrives — including the
 * case nobody writes a test for, the stream timing out (see `streamTimeout` in
 * `app/entry.server.tsx`). Without it a rejected `Await` renders nothing and
 * the writer is left reading an animation that has already given up.
 *
 * It reports too: an error caught by an `errorElement` never reaches the root
 * boundary, so this is the only place that failure is captured.
 */
export function AsyncErrorAlert({ title }: { title: string }) {
	const error = useAsyncError()
	const posthog = usePostHog()

	useEffect(() => {
		if (error instanceof Error) posthog?.captureException(error)
	}, [error, posthog])

	return (
		<Alert variant="destructive">
			<AlertCircleIcon />
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>Reload the page to try again.</AlertDescription>
		</Alert>
	)
}
