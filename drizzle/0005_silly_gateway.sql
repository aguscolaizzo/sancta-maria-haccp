CREATE TABLE `label_print_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`preparation_label_id` text NOT NULL,
	`printed_at` text NOT NULL,
	`printer_model` text DEFAULT 'T50M Pro' NOT NULL,
	`transport` text DEFAULT 'web_serial_bluetooth' NOT NULL,
	`copies` integer DEFAULT 1 NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `label_print_events_owner_id` ON `label_print_events` (`owner_id`,`id`);--> statement-breakpoint
CREATE TABLE `preparation_source_lots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`preparation_label_id` text NOT NULL,
	`supplier_lot_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preparation_source_lots_unique` ON `preparation_source_lots` (`owner_id`,`preparation_label_id`,`supplier_lot_id`);--> statement-breakpoint
CREATE TABLE `supplier_lots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`ingredient_name` text NOT NULL,
	`supplier_lot` text NOT NULL,
	`received_at` text NOT NULL,
	`supplier_deadline` text,
	`quantity` text DEFAULT '' NOT NULL,
	`storage_mode` text DEFAULT 'refrigerated' NOT NULL,
	`storage_temperature` real,
	`document_ref` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_lots_owner_id` ON `supplier_lots` (`owner_id`,`id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_owner_id` ON `suppliers` (`owner_id`,`id`);