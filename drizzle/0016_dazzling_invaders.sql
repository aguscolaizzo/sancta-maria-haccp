CREATE TABLE `hygiene_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`record_id` text NOT NULL,
	`check_code` text NOT NULL,
	`label` text NOT NULL,
	`frequency` text NOT NULL,
	`protocol` text NOT NULL,
	`optional` integer DEFAULT false NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`observation` text DEFAULT '' NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hygiene_checks_record_code` ON `hygiene_checks` (`owner_id`,`record_id`,`check_code`);--> statement-breakpoint
CREATE INDEX `hygiene_checks_record_order` ON `hygiene_checks` (`owner_id`,`record_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `hygiene_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`record_type` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`operator_initials` text NOT NULL,
	`general_notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`signature` text,
	`validated_at` text,
	`validated_by_id` text,
	`validated_by_name` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_at` text,
	`updated_by_id` text,
	`updated_by_name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hygiene_records_owner_type_date` ON `hygiene_records` (`owner_id`,`record_type`,`date`);--> statement-breakpoint
CREATE INDEX `hygiene_records_owner_date` ON `hygiene_records` (`owner_id`,`date`,`record_type`);