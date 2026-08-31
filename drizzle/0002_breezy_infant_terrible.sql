PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#F06B52' NOT NULL,
	`hourly_rate_cents` integer,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "client_id", "name", "color", "hourly_rate_cents", "archived", "created_at") SELECT "id", "client_id", "name", "color", "hourly_rate_cents", "archived", "created_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_projects_client_id` ON `projects` (`client_id`);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `invoiced_at` text;