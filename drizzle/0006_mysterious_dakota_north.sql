CREATE TABLE `reception_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`reception_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`field_name` text DEFAULT '' NOT NULL,
	`old_value` text,
	`new_value` text,
	`changed_at` text NOT NULL,
	`changed_by_id` text NOT NULL,
	`changed_by_name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reception_audit_reception` ON `reception_audit_events` (`owner_id`,`reception_id`,`changed_at`);--> statement-breakpoint
CREATE TABLE `reception_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`reception_id` text NOT NULL,
	`product_id` text,
	`kind` text NOT NULL,
	`mime_type` text NOT NULL,
	`data_url` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `reception_photos_reception` ON `reception_photos` (`owner_id`,`reception_id`);--> statement-breakpoint
CREATE TABLE `reception_products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`reception_id` text NOT NULL,
	`product_name` text NOT NULL,
	`category` text DEFAULT 'Autres' NOT NULL,
	`temperature_regime` text NOT NULL,
	`quantity` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT 'kg' NOT NULL,
	`supplier_lot` text DEFAULT '' NOT NULL,
	`deadline_type` text DEFAULT 'none' NOT NULL,
	`deadline_date` text,
	`storage_temperature` real,
	`max_temperature` real,
	`packaging_compliant` integer,
	`visual_compliant` integer,
	`cleanliness_compliant` integer,
	`humidity_absent` integer,
	`pests_absent` integer,
	`product_compliant` integer,
	`selected_for_measurement` integer DEFAULT false NOT NULL,
	`suggested_for_measurement` integer DEFAULT false NOT NULL,
	`risk_level` text DEFAULT 'normal' NOT NULL,
	`ir_temperature` real,
	`probe_temperature` real,
	`measurement_method` text DEFAULT '' NOT NULL,
	`remeasure_temperature` real,
	`observations` text DEFAULT '' NOT NULL,
	`decision_type` text,
	`concerned_quantity` text DEFAULT '' NOT NULL,
	`non_conformity_reason` text DEFAULT '' NOT NULL,
	`non_conformity_comment` text DEFAULT '' NOT NULL,
	`corrective_action` text DEFAULT '' NOT NULL,
	`final_decision` text DEFAULT '' NOT NULL,
	`supplier_lot_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_at` text,
	`updated_by_id` text,
	`updated_by_name` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `reception_products_reception` ON `reception_products` (`owner_id`,`reception_id`);--> statement-breakpoint
CREATE INDEX `reception_products_lot` ON `reception_products` (`owner_id`,`supplier_lot`);--> statement-breakpoint
CREATE TABLE `receptions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`reception_code` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`supplier_id` text,
	`supplier_name` text DEFAULT '' NOT NULL,
	`delivery_note` text DEFAULT '' NOT NULL,
	`order_number` text DEFAULT '' NOT NULL,
	`driver_name` text DEFAULT '' NOT NULL,
	`general_notes` text DEFAULT '' NOT NULL,
	`validation_pin_hash` text,
	`pin_used` integer DEFAULT false NOT NULL,
	`validated_at` text,
	`validated_by_id` text,
	`validated_by_name` text,
	`validation_device` text DEFAULT '' NOT NULL,
	`driver_company` text DEFAULT '' NOT NULL,
	`driver_initials` text DEFAULT '' NOT NULL,
	`driver_signature` text,
	`driver_signed_at` text,
	`driver_refused_sign` integer DEFAULT false NOT NULL,
	`driver_refusal_comment` text DEFAULT '' NOT NULL,
	`driver_recorded_by_id` text,
	`driver_recorded_by_name` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`updated_at` text,
	`updated_by_id` text,
	`updated_by_name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receptions_owner_code` ON `receptions` (`owner_id`,`reception_code`);--> statement-breakpoint
CREATE INDEX `receptions_owner_created` ON `receptions` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `receptions_owner_supplier` ON `receptions` (`owner_id`,`supplier_id`);