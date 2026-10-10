import { and, eq, gt } from "drizzle-orm"
import { session } from "./schema/auth-schema"
import type { Database } from "./types"

/**
 * The writer's sessions that have not yet expired, token included.
 *
 * Read here rather than through `auth.api.listSessions`, because better-auth
 * refuses that endpoint once the session asking is older than `freshAge` (a day
 * by default) — so a writer who signed in yesterday could not open their own
 * settings. The filter is the one better-auth applies itself.
 *
 * The token is the session, so callers project it away before anything reaches
 * a page (`describeSessions`), and keep it only to revoke.
 */
export async function listActiveSessions(db: Database, userId: string) {
	return db.query.session.findMany({
		where: and(eq(session.userId, userId), gt(session.expiresAt, new Date())),
	})
}
