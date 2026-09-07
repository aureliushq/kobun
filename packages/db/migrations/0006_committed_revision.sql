DROP INDEX `editor_draft_publishedAt_idx`;--> statement-breakpoint
ALTER TABLE `editor_draft` RENAME COLUMN `published_revision` TO `committed_revision`;--> statement-breakpoint
ALTER TABLE `editor_draft` RENAME COLUMN `published_at` TO `committed_at`;--> statement-breakpoint
CREATE INDEX `editor_draft_committedAt_idx` ON `editor_draft` (`committed_at`);
