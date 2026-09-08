import { ExternalLinkIcon } from "lucide-react"
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/ui/components/base/avatar"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"

export interface SettingsUser {
	email: string
	image: string | null
	name: string
}

/** The first letter of a name, for the writer whose GitHub avatar will not load. */
function initial(name: string) {
	return name.trim().charAt(0).toUpperCase() || "?"
}

/**
 * Who Kobun thinks the writer is.
 *
 * Read-only, and it has to look read-only rather than merely refuse to save:
 * every one of these comes from GitHub through better-auth, and a field Kobun
 * let someone edit would drift from the account it was copied from the moment
 * they did. So this renders text and points at the place the values are
 * actually kept.
 */
export function ProfileSection({ user }: { user: SettingsUser }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Profile</CardTitle>
				<CardDescription>
					Your name, email and avatar come from GitHub. Kobun reads them and
					never changes them — to edit any of these, change them on{" "}
					<a
						className="inline-flex items-center gap-1 underline underline-offset-2"
						href="https://github.com/settings/profile"
						rel="noreferrer"
						target="_blank"
					>
						your GitHub profile <ExternalLinkIcon className="size-3" />
					</a>{" "}
					and sign in again.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Avatar className="size-12">
					{user.image ? <AvatarImage alt="" src={user.image} /> : null}
					<AvatarFallback>{initial(user.name)}</AvatarFallback>
				</Avatar>
				<dl className="grid gap-1">
					<div className="flex gap-2">
						<dt className="text-muted-foreground">Name</dt>
						<dd className="font-medium">{user.name}</dd>
					</div>
					<div className="flex gap-2">
						<dt className="text-muted-foreground">Email</dt>
						<dd className="font-medium">{user.email}</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	)
}
