CREATE TABLE `preparation_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`product_code` text NOT NULL,
	`product_name` text NOT NULL,
	`storage_mode` text NOT NULL,
	`storage_temperature` integer NOT NULL,
	`duration_hours` integer NOT NULL,
	`prepared_at` text NOT NULL,
	`frozen_at` text,
	`expires_at` text NOT NULL,
	`operator_initials` text NOT NULL,
	`lot_code` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preparation_labels_owner_id` ON `preparation_labels` (`owner_id`,`id`);