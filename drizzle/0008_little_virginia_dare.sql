ALTER TABLE `preparation_labels` ADD `lifecycle_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `lifecycle_updated_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `lifecycle_updated_by_id` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `lifecycle_updated_by_name` text;--> statement-breakpoint
CREATE INDEX `preparation_labels_owner_expiry` ON `preparation_labels` (`owner_id`,`lifecycle_status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `internal_preparations_owner_expiry` ON `internal_preparations` (`owner_id`,`status`,`expires_at`);