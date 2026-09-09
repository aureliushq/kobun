import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react"
import { useFetcher } from "react-router"
import { Timestamp } from "@/core/preferences/timestamp"
import { ConfigAlerts } from "@/core/project-context/config-alerts"
import { ConfigStatus } from "@/db/types"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import { SettingsActionIntents } from "@/ui/lib/types"
import type { ProjectConfigView } from "./project-config"

const STATUS_LABELS: Record<ConfigStatus, string> = {
	[ConfigStatus.ERROR]: "Invalid",
	[ConfigStatus.MISSING]: "Missing",
	[ConfigStatus.PRESENT]: "Valid",
	[ConfigStatus.TOO_LARGE]: "Too large",
	[ConfigStatus.UNKNOWN]: "Not checked yet",
}

/**
 * The status, in words the alerts below it will not contradict.
 *
 * A Config that was served still carries the parts of it that did not validate
 * (ADR-0007), so a bare "Valid" would sit directly above a list of what is
 * wrong with it. A Project nothing has read yet is not broken either, and must
 * not be painted as though it were.
 */
function StatusBadge({
	errorCount,
	status,
}: {
	errorCount: number
	status: ConfigStatus
}) {
	if (status === ConfigStatus.PRESENT) {
		return errorCount > 0 ? (
			<Badge variant="secondary">Valid, with errors</Badge>
		) : (
			<Badge variant="outline">Valid</Badge>
		)
	}

	return (
		<Badge
			variant={status === ConfigStatus.UNKNOWN ? "secondary" : "destructive"}
		>
			{STATUS_LABELS[status]}
		</Badge>
	)
}

/**
 * Refreshing is the one thing a writer can do to a Config from Kobun, and it
 * changes nothing the file says: it re-reads the repository and stores what it
 * found. There is no webhook, so this is how a Config fixed on GitHub becomes
 * true here before the cache's own window closes (ADR-0003).
 */
function RefreshButton() {
	const fetcher = useFetcher({ key: "refresh-configuration" })

	return (
		<Button
			disabled={fetcher.state !== "idle"}
			onClick={() =>
				fetcher.submit(
					{ intent: SettingsActionIntents.REFRESH_CONFIGURATION },
					{ method: "POST" },
				)
			}
			size="sm"
			variant="outline"
		>
			<RefreshCcwIcon />
			Refresh configuration
		</Button>
	)
}

/**
 * What Kobun knows about the repository's Config file, and nothing it declares.
 *
 * Every value here is Kobun's own record of a read — the path it read, whether
 * that read worked, and when it last happened. The file's contents belong to
 * the repository, so this points at the file rather than showing a form
 * (ADR-0010).
 */
export function ProjectConfigSection({
	config,
}: {
	config: ProjectConfigView
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Configuration</CardTitle>
				<CardDescription>
					Kobun reads this file from your repository. Everything it declares —
					your Collections and Singletons, their schemas and Features, and
					anything later added to it such as a commit message template, a
					timestamp format or a YAML output style — is changed by editing the
					file, which is a commit rather than a setting.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<dl className="grid gap-2">
					<div className="flex items-center gap-2">
						<dt className="text-muted-foreground">File</dt>
						<dd className="font-medium">
							{config.fileUrl ? (
								<a
									className="inline-flex items-center gap-1 underline underline-offset-2"
									href={config.fileUrl}
									rel="noreferrer"
									target="_blank"
								>
									{config.path} <ExternalLinkIcon className="size-3" />
								</a>
							) : (
								config.path
							)}
						</dd>
					</div>
					<div className="flex items-center gap-2">
						<dt className="text-muted-foreground">Status</dt>
						<dd>
							<StatusBadge
								errorCount={config.errors.length}
								status={config.status}
							/>
						</dd>
					</div>
					<div className="flex items-center gap-2">
						<dt className="text-muted-foreground">Last checked</dt>
						<dd className="font-medium">
							{config.lastCheckedAt ? (
								<Timestamp value={new Date(config.lastCheckedAt)} />
							) : (
								"Never"
							)}
						</dd>
					</div>
				</dl>
				<ConfigAlerts errors={config.errors} />
				<div>
					<RefreshButton />
				</div>
			</CardContent>
		</Card>
	)
}
