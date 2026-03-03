import { GithubIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Field, FieldDescription, FieldGroup } from "~/components/ui/field";
import { cn } from "~/lib/utils";

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Sign In</CardTitle>
					<CardDescription>Login with your Github account</CardDescription>
				</CardHeader>
				<CardContent>
					<form>
						<FieldGroup>
							<Field>
								<Button variant="outline" type="button">
									<GithubIcon />
									Login with Github
								</Button>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
			<FieldDescription className="px-4">
				By clicking continue, you agree to our{" "}
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
	);
}
