CREATE TABLE `collection_listing` (
	`project_id` text NOT NULL,
	`directory_path` text NOT NULL,
	`items` text NOT NULL,
	`entries_hash` text NOT NULL,
	`etag` text,
	`checked_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `directory_path`),
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
