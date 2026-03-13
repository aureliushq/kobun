CREATE TABLE `github_installation` (
	`id` text PRIMARY KEY NOT NULL,
	`github_installation_id` text NOT NULL,
	`target_id` text NOT NULL,
	`target_login` text NOT NULL,
	`target_avatar_url` text NOT NULL,
	`target_html_url` text NOT NULL,
	`repository_selection` text NOT NULL,
	`suspended_at` integer,
	`deleted_at` integer,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_installation_github_installation_id_unique` ON `github_installation` (`github_installation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `github_installation_githubInstallationId_idx` ON `github_installation` (`github_installation_id`);--> statement-breakpoint
CREATE INDEX `github_installation_targetLogin_idx` ON `github_installation` (`target_login`);--> statement-breakpoint
CREATE INDEX `github_installation_deletedAt_idx` ON `github_installation` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `github_installation_suspendedAt_idx` ON `github_installation` (`suspended_at`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`repo_id` text NOT NULL,
	`repo_name` text NOT NULL,
	`repo_owner_login` text NOT NULL,
	`repo_html_url` text NOT NULL,
	`config_path` text NOT NULL,
	`config_status` text NOT NULL,
	`config_checked_at` integer,
	`config_error` text,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installation_id`) REFERENCES `github_installation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_userId_repoId_idx` ON `project` (`user_id`,`repo_id`);--> statement-breakpoint
CREATE INDEX `project_userId_idx` ON `project` (`user_id`);--> statement-breakpoint
CREATE INDEX `project_installationId_idx` ON `project` (`installation_id`);--> statement-breakpoint
CREATE INDEX `project_status_idx` ON `project` (`status`);--> statement-breakpoint
CREATE TABLE `user_installation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installation_id`) REFERENCES `github_installation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_installation_userId_installationId_idx` ON `user_installation` (`user_id`,`installation_id`);--> statement-breakpoint
CREATE INDEX `user_installation_userId_idx` ON `user_installation` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_installation_installationId_idx` ON `user_installation` (`installation_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);