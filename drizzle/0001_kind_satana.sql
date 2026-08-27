CREATE INDEX `idx_projects_client_id` ON `projects` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_time_entries_started_at` ON `time_entries` (`started_at`);--> statement-breakpoint
CREATE INDEX `idx_time_entries_project_id` ON `time_entries` (`project_id`);