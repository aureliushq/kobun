import { eq } from "drizzle-orm"
import {
	ArrowUpRightIcon,
	CheckIcon,
	ChevronDownIcon,
	FolderGit2Icon,
} from "lucide-react"
import { useState } from "react"
import { Form, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { githubInstallation, project, userInstallation } from "@/db/schema"
import {
	getGithubAppInstallUrl,
	getGithubInstallation,
	listGithubInstallationRepositories,
} from "@/github/octokit.server"
import { Button } from "@/ui/components/base/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/components/base/dropdown-menu"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/ui/components/base/empty"
import {
	FieldDescription,
	FieldLegend,
	FieldSet,
} from "@/ui/components/base/field"
import {
	Item,
	ItemActions,
	ItemContent,
	ItemTitle,
} from "@/ui/components/base/item"
import { ScrollArea } from "@/ui/components/base/scroll-area"
import { PATHS } from "@/ui/lib/constants"
import type { Route } from "./+types/setup"

enum ACTION_INTENTS {
	CREATE_PROJECT = "create-project",
	INSTALL_APP = "install-app",
}

export async function loader({ context, request }: Route.LoaderArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const url = new URL(request.url)
	const githubInstallationId = url.searchParams.get("installation_id")
	const receivedState = url.searchParams.get("state")

	// handle post-install callback
	if (githubInstallationId) {
		const cookieHeader = request.headers.get("Cookie")
		const cookies: Record<string, unknown> = {}
		if (cookieHeader) {
			cookieHeader.split(";").forEach((cookie) => {
				const [name, ...rest] = cookie.split("=")
				if (name && rest) {
					cookies[name.trim()] = decodeURIComponent(rest.join("="))
				}
			})
		}
		const originalState = cookies.github_install_state as string
		if (receivedState !== originalState) {
			throw redirect(PATHS.SETUP)
		}

		const installation = await getGithubInstallation(env, githubInstallationId)

		const existingInstallation = await db.query.githubInstallation.findFirst({
			where: eq(
				githubInstallation.githubInstallationId,
				String(installation.id),
			),
		})

		// upsert to githubInstallation table
		const id = existingInstallation?.id ?? String(crypto.randomUUID())
		await db
			.insert(githubInstallation)
			.values({
				// @ts-expect-error: type is wrong, id is available
				id,
				githubInstallationId: String(installation.id),
				targetId: String(installation?.account?.id),
				// @ts-expect-error: type is wrong, login is available
				targetLogin: installation?.account?.login,
				targetAvatarUrl: installation?.account?.avatar_url,
				targetHtmlUrl: installation?.account?.html_url,
				repositorySelection: installation.repository_selection,
				suspendedAt: installation.suspended_at
					? new Date(installation.suspended_at)
					: null,
				deletedAt: null,
				lastSyncedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: githubInstallation.githubInstallationId,
				set: {
					targetId: String(installation?.account?.id),
					// @ts-expect-error: type is wrong, login is available
					targetLogin: installation?.account?.login,
					targetAvatarUrl: installation?.account?.avatar_url,
					targetHtmlUrl: installation?.account?.html_url,
					repositorySelection: installation.repository_selection,
					suspendedAt: installation.suspended_at
						? new Date(installation.suspended_at)
						: null,
					deletedAt: null,
					lastSyncedAt: new Date(),
				},
			})

		// link user to installation (no-op if already linked)
		await db
			.insert(userInstallation)
			.values({
				id: crypto.randomUUID(),
				userId: session.user.id,
				installationId: id,
			})
			.onConflictDoNothing()

		return redirect(PATHS.SETUP)
	}

	const linkedInstallations = await db.query.userInstallation.findMany({
		where: eq(userInstallation.userId, session.user.id),
		with: { githubInstallation: true },
	})

	const installationsWithRepos = (
		await Promise.all(
			linkedInstallations
				.filter((li) => !li.githubInstallation.deletedAt)
				.map(async (li) => {
					try {
						const repos = await listGithubInstallationRepositories(
							env,
							li.githubInstallation.githubInstallationId,
						)
						return {
							installation: li.githubInstallation,
							repos,
						}
					} catch (error) {
						if (
							error instanceof Error &&
							"status" in error &&
							error.status === 404
						) {
							await db
								.update(githubInstallation)
								.set({ deletedAt: new Date() })
								.where(eq(githubInstallation.id, li.githubInstallation.id))
							return null
						}
						throw error
					}
				}),
		)
	).filter((item) => item !== null)

	const projects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
	})

	const projectsByRepoId = new Map(
		projects.map((project) => [project.githubRepoId, project]),
	)

	return {
		user: session.user,
		installations: installationsWithRepos.map((iwr) => ({
			...iwr,
			repos: iwr.repos.map((repo) => ({
				...repo,
				project: projectsByRepoId.get(String(repo.id)) ?? null,
			})),
		})),
		installUrl: null,
	}
}

export async function action({ context, request }: Route.ActionArgs) {
	const _db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const formData = await request.formData()
	const intent = formData.get("intent") as ACTION_INTENTS

	if (intent === ACTION_INTENTS.CREATE_PROJECT) {
		const _repoId = formData.get("repoId") as string
		const _repoName = formData.get("repoName") as string
		const _repoOwner = formData.get("repoOwner") as string
		const _repoHtmlUrl = formData.get("repoHtmlUrl") as string
		const _installationId = formData.get("installationId") as string

		// TODO: validation that the installation belongs to user
		// TODO: check config path
		// TODO: insert project
		// TODO: redirect to /dashboard
	}

	if (intent === ACTION_INTENTS.INSTALL_APP) {
		const state = crypto.randomUUID()
		const installUrl = getGithubAppInstallUrl(env, state)

		return redirect(installUrl, {
			headers: {
				"Set-Cookie": `github_install_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=${PATHS.SETUP}; Max-Age=600`,
			},
		})
	}
}

export default function Setup({ loaderData }: Route.ComponentProps) {
	const installations = loaderData.installations
	const [activeLogin, setActiveLogin] = useState(
		installations.length > 0 ? installations[0].installation.targetLogin : null,
	)

	if (installations.length > 0) {
		const LOGINS = installations.map((item) => {
			const login = item.installation.targetLogin
			return {
				label: login,
				value: login,
			}
		})
		return (
			<div className="flex w-full flex-col gap-4">
				<FieldSet>
					<FieldLegend>Create a Project</FieldLegend>
					<FieldDescription>
						Select a repository to create a new project from.
					</FieldDescription>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button className="w-fit" variant="outline" />}
						>
							{activeLogin}
							<ChevronDownIcon className="ml-2" />
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuGroup>
								<DropdownMenuLabel>Accounts</DropdownMenuLabel>
								{LOGINS.map((item) => (
									<DropdownMenuItem
										className="justify-between text-xs/relaxed"
										key={item.value}
										onClick={() => setActiveLogin(item.value)}
									>
										{item.label}
										{item.value === activeLogin && <CheckIcon />}
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
							</DropdownMenuGroup>
							<DropdownMenuGroup>
								<Form method="POST">
									<DropdownMenuItem
										render={
											<Button
												className="w-full justify-start font-normal! text-xs/relaxed! hover:bg-accent! hover:text-accent-foreground!"
												name="intent"
												type="submit"
												value={ACTION_INTENTS.INSTALL_APP}
												variant="ghost"
											/>
										}
									>
										Add Account
									</DropdownMenuItem>
								</Form>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					<ScrollArea className="h-64 w-full">
						{installations
							.find((item) => item.installation.targetLogin === activeLogin)
							?.repos.map((repo) => {
								return (
									<Item
										className="-my-px rounded-none first:mt-px first:rounded-tl-md first:rounded-tr-md last:mb-px last:rounded-br-md last:rounded-bl-md"
										key={repo.full_name}
										variant="outline"
									>
										<ItemContent>
											<ItemTitle>{repo.name}</ItemTitle>
										</ItemContent>
										<ItemActions>
											<Button size="sm" variant="secondary">
												Create Project
											</Button>
										</ItemActions>
									</Item>
								)
							})}
					</ScrollArea>
				</FieldSet>
			</div>
		)
	}

	return <NoInstallations />
}

export function NoInstallations() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FolderGit2Icon />
				</EmptyMedia>
				<EmptyTitle>Get started</EmptyTitle>
				<EmptyDescription>
					Install the Github App and choose which repositories to grant access
					to.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center gap-2">
				<Form method="POST">
					<Button
						name="intent"
						type="submit"
						value={ACTION_INTENTS.INSTALL_APP}
					>
						Install Github App
					</Button>
				</Form>
			</EmptyContent>
			<Button
				variant="link"
				className="text-muted-foreground"
				size="sm"
				nativeButton={false}
				render={
					<a
						// TODO: update this link when website and docs are ready
						href="https://kobun.io/docs/configuration/getting-started"
						rel="noopener noreferrer"
						target="_blank"
					>
						Learn More <ArrowUpRightIcon />
					</a>
				}
			/>
		</Empty>
	)
}
