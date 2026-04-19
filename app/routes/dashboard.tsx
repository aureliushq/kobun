import {
	AlertCircleIcon,
	ExternalLinkIcon,
	TriangleAlertIcon,
} from "lucide-react"
import { useRouteLoaderData } from "react-router"
import type { ConfigFetchResult } from "@/config/github.server"
import type { loader as dashboardLayoutLoader } from "@/core/components/layouts/dashboard"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"
import { H2 } from "@/ui/components/base/typegraphy"

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

function ConfigAlert({
	error,
}: {
	error: ConfigFetchResult["errors"][number]
}) {
	switch (error.code) {
		case "no_config":
			return <NoConfigAlert message={error.message} />
		case "parse_error":
			return <ParseErrorAlert filePath={error.path} message={error.message} />
		default:
			return <ValidationErrorAlert path={error.path} message={error.message} />
	}
}

export default function Dashboard() {
	const layoutData = useRouteLoaderData<typeof dashboardLayoutLoader>(
		"core/components/layouts/dashboard",
	)
	const user = layoutData?.user
	const _config = layoutData?.configResult?.config
	const errors = layoutData?.configResult?.errors ?? []

	return (
		<>
			<H2>{`Welcome ${user?.name}!`}</H2>
			{errors.length > 0 && (
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
			)}
		</>
	)
}
