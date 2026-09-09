import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/ui/components/base/avatar"

/**
 * The signed-in writer, as the chrome and the account page draw them.
 *
 * The three fields GitHub hands better-auth, narrowed from the session row by
 * whichever loader publishes it. It lives here rather than beside either
 * renderer because both of them draw the same person, and `packages/ui` may not
 * import from `app`.
 */
export interface SignedInUser {
	email: string
	image: string | null
	name: string
}

/** The first letter of a name, for the writer whose GitHub avatar will not load. */
function initial(name: string) {
	return name.trim().charAt(0).toUpperCase() || "?"
}

/**
 * The writer's face, at whatever size the caller needs.
 *
 * The image is left out rather than given an empty `src` when there is none:
 * the fallback is the answer for a writer with no avatar as much as for one
 * whose avatar will not load. `alt=""` in both callers, because the name is
 * always rendered beside it.
 */
export function UserAvatar({
	className,
	user,
}: {
	className?: string
	user: SignedInUser
}) {
	return (
		<Avatar className={className}>
			{user.image ? <AvatarImage alt="" src={user.image} /> : null}
			<AvatarFallback>{initial(user.name)}</AvatarFallback>
		</Avatar>
	)
}
