import { and, desc, eq, or } from "drizzle-orm"
import {
	ArrowUpRightIcon,
	CheckIcon,
	ChevronDownIcon,
	ExternalLinkIcon,
	FolderGit2Icon,
} from "lucide-react"
import { useState } from "react"
import { Form, Link, redirect } from "react-router"
import { getAuth } from "@/auth/auth.server"
import { envContext } from "@/core/context"
import { dbContext } from "@/db/context"
import { githubInstallation, project, userInstallation } from "@/db/schema"
import { ConfigStatus, ProjectStatus } from "@/db/types"
import {
	getGithubAppInstallUrl,
	getGithubFileContent,
	getGithubInstallation,
	listGithubInstallationRepositories,
} from "@/github/octokit.server"
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/ui/components/base/avatar"
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
import { Input } from "@/ui/components/base/input"
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
				if (name && rest.length > 0) {
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
			where: or(
				eq(githubInstallation.githubInstallationId, String(installation.id)),
				eq(githubInstallation.targetId, String(installation.account?.id)),
			),
		})

		// if the account was reinstalled with a new github installation id,
		// update the old row so the upsert's conflict target can match
		if (
			existingInstallation &&
			existingInstallation.githubInstallationId !== String(installation.id)
		) {
			await db
				.update(githubInstallation)
				.set({ githubInstallationId: String(installation.id) })
				.where(eq(githubInstallation.id, existingInstallation.id))
		}

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

	const accounts: {
		id: string
		githubInstallationId: string
		login: string
		avatarUrl: string
	}[] = linkedInstallations.map((li) => ({
		id: li.githubInstallation.id,
		githubInstallationId: li.githubInstallation.githubInstallationId,
		login: li.githubInstallation.targetLogin,
		avatarUrl: li.githubInstallation.targetAvatarUrl,
	}))

	const repos: {
		id: number
		name: string
		fullName: string
		htmlUrl: string
		ownerLogin: string
		installationId: string
	}[] = (
		await Promise.all(
			linkedInstallations
				.filter((li) => !li.githubInstallation.deletedAt)
				.map(async (li) => {
					try {
						const ghRepos = await listGithubInstallationRepositories(
							env,
							li.githubInstallation.githubInstallationId,
						)
						return ghRepos.map((repo) => ({
							id: repo.id,
							name: repo.name,
							fullName: repo.full_name,
							htmlUrl: repo.html_url,
							ownerLogin: repo.owner.login,
							installationId: li.githubInstallation.id,
						}))
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
							return []
						}
						throw error
					}
				}),
		)
	).flat()

	const allProjects = await db.query.project.findMany({
		where: eq(project.userId, session.user.id),
		orderBy: desc(project.updatedAt),
	})
	const recentProjects = allProjects.slice(0, 3)
	const projectRepoIds = allProjects.map((p) => p.repoId)

	return { accounts, repos, recentProjects, projectRepoIds }
}

export async function action({ context, request }: Route.ActionArgs) {
	const db = context.get(dbContext)
	const env = context.get(envContext)

	const auth = getAuth(env)
	const session = await auth.api.getSession({ headers: request.headers })
	if (!session?.user) throw redirect(PATHS.LOGIN)

	const formData = await request.formData()
	const intent = formData.get("intent") as ACTION_INTENTS

	if (intent === ACTION_INTENTS.CREATE_PROJECT) {
		const repoId = formData.get("repo_id") as string
		const repoName = formData.get("repo_name") as string
		const repoOwner = formData.get("repo_owner") as string
		const installationId = formData.get("installation_id") as string

		const installation = await db.query.githubInstallation.findFirst({
			where: eq(githubInstallation.id, installationId),
		})

		if (!installation)
			// TODO: throw with an error so it can be shown on the frontend
			throw redirect(PATHS.SETUP)

		if (installation?.deletedAt || installation?.suspendedAt)
			// TODO: throw with an error so it can be shown on the frontend
			throw redirect(PATHS.SETUP)

		const repos = await listGithubInstallationRepositories(
			env,
			installation.githubInstallationId,
		)

		const selectedRepo = repos.find((repo) => String(repo.id) === repoId)

		// TODO: throw with an error so it can be shown on the frontend
		if (!selectedRepo) throw redirect(PATHS.SETUP)

		const CONFIG_PATHS = [".kobun.json", ".kobun.yml"]
		let config:
			| ({ sha: string; path: string; content: string } & {
					error: string | null
					status: ConfigStatus
			  })
			| { path?: string; status: ConfigStatus; error?: string | null } = {
			status: ConfigStatus.MISSING,
		}
		for (const configPath of CONFIG_PATHS) {
			try {
				const configFile = await getGithubFileContent(
					env,
					installation.githubInstallationId,
					repoOwner,
					repoName,
					configPath,
				)
				config = { ...configFile, error: null, status: ConfigStatus.PRESENT }
				break
			} catch (error) {
				if (
					error instanceof Error &&
					"status" in error &&
					error.status === 404
				) {
					continue
				}
				config = {
					status: ConfigStatus.ERROR,
					error: error instanceof Error ? error.message : String(error),
				}
				break
			}
		}

		const existingProject = await db.query.project.findFirst({
			where: and(
				eq(project.userId, session.user.id),
				eq(project.repoId, String(repoId)),
			),
		})

		// upsert to githubInstallation table
		const id = existingProject?.id ?? String(crypto.randomUUID())
		await db
			.insert(project)
			.values({
				id,
				userId: session.user.id,
				installationId: String(installation.id),
				repoId: String(selectedRepo.id),
				repoName: selectedRepo.name,
				repoOwnerLogin: selectedRepo.owner.login,
				repoHtmlUrl: selectedRepo.html_url,
				configPath: config?.path ?? ".kobun.json",
				configStatus: config?.path
					? ConfigStatus.PRESENT
					: (config?.status ?? ConfigStatus.UNKNOWN),
				configCheckedAt: new Date(),
				configError: config?.error ? String(config.error) : "",
				status: ProjectStatus.ACTIVE,
			})
			.onConflictDoUpdate({
				target: [project.userId, project.repoId],
				set: {
					installationId: String(installation.id),
					repoName: selectedRepo.name,
					repoOwnerLogin: selectedRepo.owner.login,
					repoHtmlUrl: selectedRepo.html_url,
					configPath: config?.path ?? ".kobun.json",
					configStatus: config?.path
						? ConfigStatus.PRESENT
						: (config?.status ?? ConfigStatus.UNKNOWN),
					configCheckedAt: new Date(),
					configError: config?.error ? String(config.error) : "",
					status: ProjectStatus.ACTIVE,
				},
			})

		return redirect(`/${selectedRepo.owner.login}/${selectedRepo.name}`)
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
	const { accounts, repos, recentProjects, projectRepoIds } = loaderData
	const [activeInstallationId, setActiveInstallationId] = useState(
		accounts.length > 0 ? accounts[0].id : null,
	)

	const activeAccount = accounts.find((a) => a.id === activeInstallationId)
	const projectRepoIdSet = new Set(projectRepoIds)

	if (accounts.length > 0) {
		return (
			<div className="flex w-full flex-col gap-8">
				<FieldSet>
					<FieldLegend>Recent Projects</FieldLegend>
					<FieldDescription>
						Select a repository to create a new project from.
					</FieldDescription>
					<div className="w-full">
						{recentProjects.map((project) => (
							<Item
								className="group -my-px rounded-none first:mt-px first:rounded-tl-md first:rounded-tr-md last:mb-px last:rounded-br-md last:rounded-bl-md"
								key={project.id}
								variant="outline"
							>
								<ItemContent>
									<ItemTitle>
										{`${project.repoOwnerLogin}/${project.repoName}`}
										<a
											className="hidden group-hover:flex"
											href={project.repoHtmlUrl}
											rel="noopener noreferrer"
											target="_blank"
										>
											<ExternalLinkIcon className="size-3" />
										</a>
									</ItemTitle>
								</ItemContent>
								<ItemActions>
									<Link to={`/${project.repoOwnerLogin}/${project.repoName}`}>
										<Button size="sm" variant="secondary">
											Open
										</Button>
									</Link>
								</ItemActions>
							</Item>
						))}
					</div>
				</FieldSet>
				<FieldSet>
					<FieldLegend>Create a Project</FieldLegend>
					<FieldDescription>
						Select a repository to create a new project from.
					</FieldDescription>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button className="w-fit" variant="outline" />}
						>
							<div className="flex items-center gap-2">
								<Avatar className="size-4">
									<AvatarImage
										alt={`${activeAccount?.login}'s avatar`}
										src={activeAccount?.avatarUrl ?? ""}
									/>
									<AvatarFallback>
										{activeAccount?.login.charAt(0)}
									</AvatarFallback>
								</Avatar>
								{activeAccount?.login}
							</div>
							<ChevronDownIcon className="ml-2" />
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuGroup>
								<DropdownMenuLabel>Accounts</DropdownMenuLabel>
								{accounts.map((account) => (
									<DropdownMenuItem
										className="justify-between text-xs/relaxed"
										key={account.login}
										onClick={() => {
											setActiveInstallationId(account.id)
										}}
									>
										<div className="flex items-center gap-2">
											<Avatar className="size-4">
												<AvatarImage
													src={account.avatarUrl}
													alt={`${account.login}'s avatar`}
												/>
												<AvatarFallback>
													{account.login.charAt(0)}
												</AvatarFallback>
											</Avatar>
											{account.login}
										</div>
										{account.id === activeInstallationId && <CheckIcon />}
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
						{repos
							.filter((repo) => repo.installationId === activeInstallationId)
							.map((repo) => (
								<Item
									className="group -my-px rounded-none first:mt-px first:rounded-tl-md first:rounded-tr-md last:mb-px last:rounded-br-md last:rounded-bl-md"
									key={repo.fullName}
									variant="outline"
								>
									<ItemContent>
										<ItemTitle>
											{repo.name}
											<a
												className="hidden group-hover:flex"
												href={repo.htmlUrl}
												rel="noopener noreferrer"
												target="_blank"
											>
												<ExternalLinkIcon className="size-3" />
											</a>
										</ItemTitle>
									</ItemContent>
									<ItemActions>
										{projectRepoIdSet.has(String(repo.id)) ? (
											<Link to={`/${repo.ownerLogin}/${repo.name}`}>
												<Button size="sm" variant="secondary">
													Open
												</Button>
											</Link>
										) : (
											<Form method="POST">
												<Input name="repo_id" type="hidden" value={repo.id} />
												<Input
													name="repo_name"
													type="hidden"
													value={repo.name}
												/>
												<Input
													name="repo_owner"
													type="hidden"
													value={repo.ownerLogin}
												/>
												<Input
													name="installation_id"
													type="hidden"
													value={repo.installationId}
												/>
												<Button
													name="intent"
													size="sm"
													type="submit"
													value={ACTION_INTENTS.CREATE_PROJECT}
													variant="secondary"
												>
													Create Project
												</Button>
											</Form>
										)}
									</ItemActions>
								</Item>
							))}
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
