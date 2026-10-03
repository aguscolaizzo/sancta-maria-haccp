CREATE TABLE `readings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`initials` text NOT NULL,
	`temperatures` text NOT NULL,
	`thresholds` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`exception` integer DEFAULT false NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `readings_owner_date` ON `readings` (`owner_id`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`thresholds` text NOT NULL,
	`workbook_url` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
