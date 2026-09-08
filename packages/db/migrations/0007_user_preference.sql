CREATE TABLE `user_preference` (
	`user_id` text PRIMARY KEY NOT NULL,
	`properties_panel_open` integer DEFAULT true NOT NULL,
	`word_count_visible` integer DEFAULT true NOT NULL,
	`sidebar_open` integer DEFAULT true NOT NULL,
	`editor_width` text DEFAULT 'normal' NOT NULL,
	`editor_font` text DEFAULT 'sans' NOT NULL,
	`date_display` text DEFAULT 'relative' NOT NULL,
	`locale` text,
	`timezone` text,
	`editor_primary_action` text DEFAULT 'save' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
