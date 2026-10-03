CREATE TABLE `register_members` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`requested_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `register_members_owner_user` ON `register_members` (`owner_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `readings` ADD `created_by_id` text;--> statement-breakpoint
ALTER TABLE `readings` ADD `updated_by_id` text;