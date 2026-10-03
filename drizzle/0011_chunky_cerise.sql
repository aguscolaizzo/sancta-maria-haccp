CREATE TABLE `barcode_products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`barcode` text NOT NULL,
	`barcode_normalized` text NOT NULL,
	`product_name` text NOT NULL,
	`product_name_fr` text DEFAULT '' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`quantity` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`ingredients` text DEFAULT '' NOT NULL,
	`allergens` text DEFAULT '' NOT NULL,
	`categories` text DEFAULT '' NOT NULL,
	`countries` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`ingredient_id` text,
	`external_last_update` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_id` text NOT NULL,
	`updated_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `barcode_products_owner_normalized` ON `barcode_products` (`owner_id`,`barcode_normalized`);--> statement-breakpoint
CREATE INDEX `barcode_products_ingredient` ON `barcode_products` (`owner_id`,`ingredient_id`);