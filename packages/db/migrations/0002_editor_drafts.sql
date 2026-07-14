CREATE TABLE `editor_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`collection_slug` text NOT NULL,
	`item_slug` text,
	`source_path` text,
	`source_sha` text,
	`markdown` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`published_revision` integer,
	`published_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `editor_draft_projectId_idx` ON `editor_draft` (`project_id`);--> statement-breakpoint
CREATE INDEX `editor_draft_projectId_collectionSlug_idx` ON `editor_draft` (`project_id`,`collection_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `editor_draft_projectId_sourcePath_idx` ON `editor_draft` (`project_id`,`source_path`);--> statement-breakpoint
CREATE INDEX `editor_draft_publishedAt_idx` ON `editor_draft` (`published_at`);
