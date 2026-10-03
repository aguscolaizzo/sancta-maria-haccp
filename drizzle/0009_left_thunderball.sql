CREATE TABLE `preparation_lineage` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`target_label_id` text NOT NULL,
	`relation` text NOT NULL,
	`source_snapshot` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`scope` text DEFAULT 'partial' NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lineage_target` ON `preparation_lineage` (`owner_id`,`target_label_id`);--> statement-breakpoint
CREATE INDEX `lineage_source` ON `preparation_lineage` (`owner_id`,`source_kind`,`source_id`);