PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_editor_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`collection_slug` text,
	`singleton_slug` text,
	`item_slug` text,
	`source_path` text,
	`source_sha` text,
	`markdown` text DEFAULT '' NOT NULL,
	`metadata` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`committed_revision` integer,
	`committed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "editor_draft_owner_check" CHECK((collection_slug IS NULL) <> (singleton_slug IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_editor_draft`("id", "project_id", "collection_slug", "singleton_slug", "item_slug", "source_path", "source_sha", "markdown", "metadata", "revision", "committed_revision", "committed_at", "created_at", "updated_at") SELECT "id", "project_id", "collection_slug", "singleton_slug", "item_slug", "source_path", "source_sha", "markdown", "metadata", "revision", "committed_revision", "committed_at", "created_at", "updated_at" FROM `editor_draft`;--> statement-breakpoint
DROP TABLE `editor_draft`;--> statement-breakpoint
ALTER TABLE `__new_editor_draft` RENAME TO `editor_draft`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `editor_draft_projectId_idx` ON `editor_draft` (`project_id`);--> statement-breakpoint
CREATE INDEX `editor_draft_projectId_collectionSlug_idx` ON `editor_draft` (`project_id`,`collection_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `editor_draft_projectId_sourcePath_idx` ON `editor_draft` (`project_id`,`source_path`);--> statement-breakpoint
CREATE INDEX `editor_draft_committedAt_idx` ON `editor_draft` (`committed_at`);