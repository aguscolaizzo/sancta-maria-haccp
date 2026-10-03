ALTER TABLE `preparation_labels` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `updated_by_id` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `updated_by_name` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `deleted_by_id` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `deleted_by_name` text;