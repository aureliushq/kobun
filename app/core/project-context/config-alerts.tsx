import {
	AlertCircleIcon,
	ExternalLinkIcon,
	TriangleAlertIcon,
} from "lucide-react"
import type { ConfigError } from "@/config/types"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"
import { UNREADABLE_CONFIG } from "./config-errors"

/**
 * One Config error, in the words its code earns. Shared by the dashboard, which
 * reports a broken Config to a writer who came to write, and by the Project's
 * settings page, which reports the same thing to one who came to fix it.
 */
export function ConfigAlert({ error }: { error: ConfigError }) {
	switch (error.code) {
		case "no_config":
			return (
				<Alert variant="destructive">
					<AlertCircleIcon />
					<AlertTitle>Configuration file missing</AlertTitle>
					<AlertDescription>
						{error.message}{" "}
						<a
							className="inline-flex items-center gap-1"
							href="https://kobun.io/docs/configuration"
						>
							Learn more <ExternalLinkIcon className="size-3.5" />{" "}
						</a>
					</AlertDescription>
				</Alert>
			)
		case "parse_error":
			return (
				<Alert variant="destructive">
					<AlertCircleIcon />
					<AlertTitle>Failed to parse config</AlertTitle>
					<AlertDescription>
						Could not parse{" "}
						<code className="wrap-break-words relative inline rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
							{error.path}
						</code>
						: {error.message}
					</AlertDescription>
				</Alert>
			)
		case UNREADABLE_CONFIG:
			return (
				<Alert variant="destructive">
					<TriangleAlertIcon />
					<AlertTitle>Couldn&apos;t read your configuration</AlertTitle>
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			)
		default:
			return (
				<Alert variant="destructive">
					<TriangleAlertIcon />
					<AlertTitle>Invalid config</AlertTitle>
					<AlertDescription>
						{error.path && (
							<code className="wrap-break-words relative mr-1 inline rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
								{error.path}
							</code>
						)}
						{error.message}
					</AlertDescription>
				</Alert>
			)
	}
}

/** The list, headed by the sentence that introduces it. */
export function ConfigAlerts({ errors }: { errors: ConfigError[] }) {
	if (errors.length === 0) return null

	return (
		<>
			<p>We found the following errors in your configuration:</p>
			<div className="flex flex-col gap-3 pt-3">
				{errors.map((error, i) => (
					<ConfigAlert
						error={error}
						// biome-ignore lint/suspicious/noArrayIndexKey: it's fine
						key={i}
					/>
				))}
			</div>
		</>
	)
}
