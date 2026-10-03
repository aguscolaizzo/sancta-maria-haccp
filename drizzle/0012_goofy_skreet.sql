CREATE TABLE `preparation_label_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`preparation_label_id` text NOT NULL,
	`purpose` text DEFAULT 'supplier_evidence' NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`content_sha256` text NOT NULL,
	`original_name` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preparation_label_photos_object_key` ON `preparation_label_photos` (`object_key`);--> statement-breakpoint
CREATE INDEX `preparation_label_photos_label` ON `preparation_label_photos` (`owner_id`,`preparation_label_id`,`created_at`);