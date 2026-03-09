import { GithubIcon } from "lucide-react"
import { Form, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { Button } from "@/ui/components/base/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import { Field, FieldDescription, FieldGroup } from "@/ui/components/base/field"
import { Logo, LogoDark } from "@/ui/components/logo"
import { useTheme } from "@/ui/hooks/use-theme"
import { ONBOARDING_PATH } from "@/ui/lib/constants"
import type { Route } from "./+types/login"

export async function loader({ context, request }: Route.LoaderArgs) {
	const auth = getAuth(context.get(envContext))

	const session = await auth.api.getSession({
		headers: request.headers,
	})

	if (session?.user) {
		return redirect(ONBOARDING_PATH)
	}
}

export async function action({ context, request }: Route.ActionArgs) {
	const auth = getAuth(context.get(envContext))
	const response = await auth.api.signInSocial({
		asResponse: true,
		body: { provider: "github" },
		headers: request.headers,
	})
	if (response.ok && response.headers) {
		const url = response.headers.get("location")
		if (url) {
			return redirect(url, { headers: response.headers })
		}
	}
}

export default function LoginPage() {
	const { resolvedTheme } = useTheme()

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<a
					className="flex items-center justify-start"
					href="https://kobun.io"
					rel="noopener noreferrer"
					target="_blank"
				>
					{resolvedTheme === "light" ? <Logo /> : <LogoDark />}
				</a>
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader>
							<CardTitle className="font-medium text-lg">Sign In</CardTitle>
							<CardDescription className="font-mono">
								Login with your Github account
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form method="POST">
								<FieldGroup>
									<Field>
										<Button type="submit">
											<GithubIcon />
											Login with Github
										</Button>
									</Field>
								</FieldGroup>
							</Form>
						</CardContent>
					</Card>
					<FieldDescription className="px-4 font-mono">
						By signing in, you agree to our{" "}
						<a
							href="https://kobun.io/tos"
							rel="noopener noreferrer"
							target="_blank"
						>
							Terms of Service
						</a>{" "}
						and{" "}
						<a
							href="https://kobun.io/privacy"
							rel="noopener noreferrer"
							target="_blank"
						>
							Privacy Policy
						</a>
						.
					</FieldDescription>
				</div>
			</div>
		</div>
	)
}
