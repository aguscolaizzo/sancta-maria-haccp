ALTER TABLE `preparation_labels` ADD `category` text DEFAULT 'Préparations cuisinées' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `process_type` text DEFAULT 'cold_preparation' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `source_state` text DEFAULT 'fresh' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `quantity` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `packaging` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `supplier_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `supplier_lot` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `supplier_deadline` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `received_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `opened_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `source_label_id` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooking_ended_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooking_temperature` real;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooling_started_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooling_start_temperature` real;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooling_ended_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooling_end_temperature` real;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooling_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooling_duration_minutes` integer;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `cooling_compliant` integer;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `thawing_started_at` text;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `thawing_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `freeze_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `freezer_temperature` real;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `corrective_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `preparation_labels` ADD `control_status` text DEFAULT 'not_applicable' NOT NULL;