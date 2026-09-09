import { FileTextIcon } from "lucide-react"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/ui/components/base/card"
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/ui/components/base/empty"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/ui/components/base/table"
import type { DeclaredEntity } from "./project-config"

function DeclaredTable({
	entities,
	kind,
}: {
	entities: DeclaredEntity[]
	kind: string
}) {
	if (entities.length === 0) return null

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{kind}</TableHead>
					<TableHead>Slug</TableHead>
					<TableHead>Format</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{entities.map((entity) => (
					<TableRow key={entity.slug}>
						<TableCell className="font-medium">{entity.label}</TableCell>
						<TableCell className="text-muted-foreground">
							{entity.slug}
						</TableCell>
						<TableCell className="text-muted-foreground">
							{entity.format}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}

/**
 * What the Config declares, read-only.
 *
 * These are the repository's to change — versioned, reviewable, and the same
 * for everyone who writes into it — so this page lists them and says where they
 * are declared rather than offering a field (ADR-0010).
 *
 * A Config Kobun could not read declares nothing it can list, and the
 * Configuration section above has already said what went wrong; this one says
 * only that there is nothing to show.
 */
export function ProjectContentSection({
	collections,
	singletons,
}: {
	collections: DeclaredEntity[]
	singletons: DeclaredEntity[]
}) {
	const empty = collections.length === 0 && singletons.length === 0

	return (
		<Card>
			<CardHeader>
				<CardTitle>Declared content</CardTitle>
				<CardDescription>
					The Collections and Singletons your configuration file declares.
					Change them by editing that file.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{empty ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<FileTextIcon />
							</EmptyMedia>
							<EmptyTitle>Nothing declared</EmptyTitle>
							<EmptyDescription>
								Kobun has no configuration it can read for this Project, so
								there is nothing to list.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<>
						<DeclaredTable entities={collections} kind="Collection" />
						<DeclaredTable entities={singletons} kind="Singleton" />
					</>
				)}
			</CardContent>
		</Card>
	)
}
