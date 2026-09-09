import {
	AlertCircleIcon,
	ExternalLinkIcon,
	TriangleAlertIcon,
} from "lucide-react"
import type { ConfigError } from "@/config/types"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"
import { UNREADABLE_CONFIG } from "./config-errors"

function NoConfigAlert({ message }: { message: string }) {
	return (
		<Alert variant="destructive">
			<AlertCircleIcon />
			<AlertTitle>Configuration file missing</AlertTitle>
			<AlertDescription>
				{message}{" "}
				<a
					className="inline-flex items-center gap-1"
					href="https://kobun.io/docs/configuration"
				>
					Learn more <ExternalLinkIcon className="size-3.5" />{" "}
				</a>
			</AlertDescription>
		</Alert>
	)
}

function ParseErrorAlert({
	filePath,
	message,
}: {
	filePath: string
	message: string
}) {
	return (
		<Alert variant="destructive">
			<AlertCircleIcon />
			<AlertTitle>Failed to parse config</AlertTitle>
			<AlertDescription>
				Could not parse{" "}
				<code className="wrap-break-words relative inline rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
					{filePath}
				</code>
				: {message}
			</AlertDescription>
		</Alert>
	)
}

function ValidationErrorAlert({
	path,
	message,
}: {
	path: string
	message: string
}) {
	return (
		<Alert variant="destructive">
			<TriangleAlertIcon />
			<AlertTitle>Invalid config</AlertTitle>
			<AlertDescription>
				{path && (
					<code className="wrap-break-words relative mr-1 inline rounded-md bg-muted px-[0.3rem] py-[0.2rem] font-mono text-[0.8rem] outline-none">
						{path}
					</code>
				)}
				{message}
			</AlertDescription>
		</Alert>
	)
}

function UnreadableConfigAlert({ message }: { message: string }) {
	return (
		<Alert variant="destructive">
			<TriangleAlertIcon />
			<AlertTitle>Couldn&apos;t read your configuration</AlertTitle>
			<AlertDescription>{message}</AlertDescription>
		</Alert>
	)
}

/**
 * One Config error, in the words its code earns. Shared by the dashboard, which
 * reports a broken Config to a writer who came to write, and by the Project's
 * settings page, which reports the same thing to one who came to fix it.
 */
export function ConfigAlert({ error }: { error: ConfigError }) {
	switch (error.code) {
		case "no_config":
			return <NoConfigAlert message={error.message} />
		case "parse_error":
			return <ParseErrorAlert filePath={error.path} message={error.message} />
		case UNREADABLE_CONFIG:
			return <UnreadableConfigAlert message={error.message} />
		default:
			return <ValidationErrorAlert path={error.path} message={error.message} />
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
