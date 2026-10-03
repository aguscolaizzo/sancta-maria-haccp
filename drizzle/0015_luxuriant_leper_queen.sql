CREATE TABLE `printer_diagnostic_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`context` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`connected` integer,
	`transport_info` text DEFAULT '{}' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`events_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `printer_diagnostic_owner_created` ON `printer_diagnostic_reports` (`owner_id`,`created_at`);