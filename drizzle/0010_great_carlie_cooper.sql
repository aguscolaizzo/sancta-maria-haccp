CREATE TABLE `product_barcodes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`code` text NOT NULL,
	`sample_value` text DEFAULT '' NOT NULL,
	`format` text DEFAULT 'inconnu' NOT NULL,
	`ingredient_id` text NOT NULL,
	`supplier_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_at` text,
	`updated_by_id` text,
	`updated_by_name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_barcodes_owner_code` ON `product_barcodes` (`owner_id`,`code`);--> statement-breakpoint
CREATE INDEX `product_barcodes_ingredient` ON `product_barcodes` (`owner_id`,`ingredient_id`);