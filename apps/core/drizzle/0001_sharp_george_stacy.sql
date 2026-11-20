ALTER TABLE `requirements` ADD `kind` text DEFAULT 'requirement' NOT NULL;--> statement-breakpoint
CREATE INDEX `requirements_kind_index` ON `requirements` (`kind`);