import { formatDistanceToNow } from "date-fns"
import { useFetcher } from "react-router"
import { Badge } from "@/ui/components/base/badge"
import { Button } from "@/ui/components/base/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/ui/components/base/table"
import { SettingsActionIntents } from "@/ui/lib/types"
import type { SettingsSession } from "./sessions"

function RevokeButton({ sessionId }: { sessionId: string }) {
	const fetcher = useFetcher({ key: `session:${sessionId}` })

	return (
		<Button
			disabled={fetcher.state !== "idle"}
			onClick={() =>
				fetcher.submit(
					{ intent: SettingsActionIntents.REVOKE_SESSION, sessionId },
					{ method: "POST" },
				)
			}
			size="sm"
			variant="ghost"
		>
			Revoke
		</Button>
	)
}

/**
 * Every browser currently signed in as this writer.
 *
 * The row the writer is reading on is listed but offers no Revoke: ending your
 * own session from here is signing out, which the sidebar already does and says
 * plainly. A Revoke button that logged you out would be the same act wearing
 * the wrong name.
 *
 * Nothing in a row can sign anyone in — `describeSessions` leaves the token
 * behind on the server, and revoking names a session by id.
 */
export function SessionsSection({ sessions }: { sessions: SettingsSession[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Active sessions</CardTitle>
				<CardDescription>
					Where you are signed in. Revoking a session signs that browser out the
					next time it asks Kobun for anything.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Device</TableHead>
							<TableHead>IP address</TableHead>
							<TableHead>Signed in</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{sessions.map((session) => (
							<TableRow key={session.id}>
								<TableCell className="flex items-center gap-2">
									{session.label}
									{session.current ? (
										<Badge variant="outline">This device</Badge>
									) : null}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{session.ipAddress ?? "Unknown"}
								</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDistanceToNow(new Date(session.createdAt), {
										addSuffix: true,
									})}
								</TableCell>
								<TableCell className="text-right">
									{session.current ? null : (
										<RevokeButton sessionId={session.id} />
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}
