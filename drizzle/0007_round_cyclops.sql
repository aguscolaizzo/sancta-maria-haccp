CREATE TABLE `daily_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`sequence_date` text NOT NULL,
	`kind` text NOT NULL,
	`next_value` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_sequences_unique` ON `daily_sequences` (`owner_id`,`sequence_date`,`kind`);--> statement-breakpoint
CREATE TABLE `ingredient_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`legacy_code` text NOT NULL,
	`display_name` text NOT NULL,
	`short_name` text NOT NULL,
	`category` text DEFAULT 'Autres' NOT NULL,
	`product_type` text DEFAULT 'frais' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`quick_enabled` integer DEFAULT false NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 1000 NOT NULL,
	`preparation_days` text DEFAULT '[]' NOT NULL,
	`default_operation` text NOT NULL,
	`storage_mode` text DEFAULT 'refrigerated' NOT NULL,
	`storage_temperature` real,
	`default_bacs` integer DEFAULT 1 NOT NULL,
	`default_labels` integer DEFAULT 1 NOT NULL,
	`label_format` text DEFAULT '50x30' NOT NULL,
	`technical_description` text DEFAULT '' NOT NULL,
	`allergens` text DEFAULT '' NOT NULL,
	`preparation_procedure` text DEFAULT '' NOT NULL,
	`handling_rules` text DEFAULT '' NOT NULL,
	`usage_count` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`updated_by_id` text,
	`updated_by_name` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_catalog_owner_code` ON `ingredient_catalog` (`owner_id`,`legacy_code`);--> statement-breakpoint
CREATE INDEX `ingredient_catalog_quick` ON `ingredient_catalog` (`owner_id`,`quick_enabled`,`display_order`);--> statement-breakpoint
CREATE TABLE `ingredient_operation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`operation_type` text NOT NULL,
	`duration_hours` integer NOT NULL,
	`storage_mode` text NOT NULL,
	`storage_temperature` real,
	`requires_source_lot` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredient_operation_unique` ON `ingredient_operation_rules` (`owner_id`,`ingredient_id`,`operation_type`);--> statement-breakpoint
CREATE TABLE `internal_preparation_source_lots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`preparation_id` text NOT NULL,
	`supplier_lot_id` text NOT NULL,
	`quantity_used` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_preparation_source_unique` ON `internal_preparation_source_lots` (`owner_id`,`preparation_id`,`supplier_lot_id`);--> statement-breakpoint
CREATE TABLE `internal_preparations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`preparation_code` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`ingredient_name` text NOT NULL,
	`short_name` text NOT NULL,
	`operation_type` text NOT NULL,
	`prepared_at` text NOT NULL,
	`duration_hours` integer NOT NULL,
	`expires_at` text NOT NULL,
	`storage_mode` text NOT NULL,
	`storage_temperature` real,
	`bac_count` integer NOT NULL,
	`label_count` integer NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`operator_initials` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`manual_source_lot` text DEFAULT '' NOT NULL,
	`manual_source_reason` text DEFAULT '' NOT NULL,
	`technical_snapshot` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_at` text,
	`updated_by_id` text,
	`updated_by_name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_preparations_owner_code` ON `internal_preparations` (`owner_id`,`preparation_code`);--> statement-breakpoint
CREATE INDEX `internal_preparations_owner_created` ON `internal_preparations` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `internal_preparations_ingredient` ON `internal_preparations` (`owner_id`,`ingredient_id`,`prepared_at`);--> statement-breakpoint
CREATE TABLE `label_print_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`physical_label_id` text NOT NULL,
	`print_job_id` text NOT NULL,
	`print_job_item_id` text NOT NULL,
	`transmission_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`outcome` text DEFAULT 'started' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`error_code` text DEFAULT '' NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`settings_snapshot` text DEFAULT '{}' NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `label_print_attempts_transmission` ON `label_print_attempts` (`owner_id`,`transmission_id`);--> statement-breakpoint
CREATE INDEX `label_print_attempts_label` ON `label_print_attempts` (`owner_id`,`physical_label_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `physical_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`label_code` text NOT NULL,
	`short_token` text NOT NULL,
	`preparation_id` text NOT NULL,
	`bac_id` text NOT NULL,
	`label_format` text DEFAULT '50x30' NOT NULL,
	`status` text DEFAULT 'to_print' NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `physical_labels_owner_code` ON `physical_labels` (`owner_id`,`label_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `physical_labels_token` ON `physical_labels` (`short_token`);--> statement-breakpoint
CREATE INDEX `physical_labels_preparation` ON `physical_labels` (`owner_id`,`preparation_id`);--> statement-breakpoint
CREATE TABLE `preparation_bacs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`preparation_id` text NOT NULL,
	`bac_code` text NOT NULL,
	`bac_index` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preparation_bacs_owner_code` ON `preparation_bacs` (`owner_id`,`bac_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `preparation_bacs_index` ON `preparation_bacs` (`owner_id`,`preparation_id`,`bac_index`);--> statement-breakpoint
CREATE TABLE `print_job_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`print_job_id` text NOT NULL,
	`physical_label_id` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`error_code` text DEFAULT '' NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`settings_snapshot` text DEFAULT '{}' NOT NULL,
	`transmission_id` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `print_job_items_position` ON `print_job_items` (`owner_id`,`print_job_id`,`position`);--> statement-breakpoint
CREATE INDEX `print_job_items_label` ON `print_job_items` (`owner_id`,`physical_label_id`);--> statement-breakpoint
CREATE TABLE `print_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`printer_model` text DEFAULT 'T50M Pro' NOT NULL,
	`transport` text DEFAULT 'web_serial_bluetooth' NOT NULL,
	`requested_at` text NOT NULL,
	`completed_at` text,
	`requested_by_id` text NOT NULL,
	`requested_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `print_jobs_owner_requested` ON `print_jobs` (`owner_id`,`requested_at`);--> statement-breakpoint
CREATE TABLE `traceability_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`field_name` text DEFAULT '' NOT NULL,
	`old_value` text,
	`new_value` text,
	`reason` text DEFAULT '' NOT NULL,
	`changed_at` text NOT NULL,
	`changed_by_id` text NOT NULL,
	`changed_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `traceability_audit_entity` ON `traceability_audit_events` (`owner_id`,`entity_type`,`entity_id`,`changed_at`);