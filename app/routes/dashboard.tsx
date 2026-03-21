import { and, eq } from "drizzle-orm"
import {
	AlertCircleIcon,
	ExternalLinkIcon,
	TriangleAlertIcon,
} from "lucide-react"
import { redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import {
	type ConfigFetchResult,
	fetchAndParseConfig,
} from "@/config/github.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { project } from "@/db/schema"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/base/alert"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/dashboard"

export async function loader({ context, params, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const { owner, name } = params
	const currentProject = await db.query.project.findFirst({
		where: and(
			eq(project.userId, session.user.id),
			eq(project.repoOwnerLogin, owner),
			eq(project.repoName, name),
		),
		with: { githubInstallation: true },
	})

	if (!currentProject) throw redirect(PATHS.SETUP)

	const config = await fetchAndParseConfig(
		env,
		currentProject.githubInstallation.githubInstallationId,
		owner,
		name,
	)

	return { config }
}

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

export default function IndexRoute({ loaderData }: Route.ComponentProps) {
	const { config } = loaderData

	if (config.errors.length > 0) {
		return (
			<div className="flex flex-col gap-3 pt-3">
				{config.errors.map((error, i) => (
					<ConfigAlert
						error={error}
						// biome-ignore lint/suspicious/noArrayIndexKey: it's fine
						key={i}
					/>
				))}
			</div>
		)
	}

	return <div>Welcome!</div>
}
