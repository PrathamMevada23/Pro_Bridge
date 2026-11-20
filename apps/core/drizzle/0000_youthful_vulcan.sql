CREATE TABLE `agent_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`agent_session_id` text,
	`task_id` text,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`details` text,
	`modified_files` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_session_id`) REFERENCES `agent_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `agent_reports_project_id_index` ON `agent_reports` (`project_id`);--> statement-breakpoint
CREATE INDEX `agent_reports_created_at_index` ON `agent_reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`external_session_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_sessions_project_id_index` ON `agent_sessions` (`project_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`provider` text NOT NULL,
	`provider_conversation_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_synced_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_provider_conversation_unique` ON `conversations` (`provider`,`provider_conversation_id`);--> statement-breakpoint
CREATE INDEX `conversations_project_id_index` ON `conversations` (`project_id`);--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`conversation_id` text,
	`source_message_id` text,
	`text` text NOT NULL,
	`rationale` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `decisions_project_id_index` ON `decisions` (`project_id`);--> statement-breakpoint
CREATE INDEX `decisions_status_index` ON `decisions` (`status`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`conversation_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_project_id_index` ON `events` (`project_id`);--> statement-breakpoint
CREATE INDEX `events_created_at_index` ON `events` (`created_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`provider_message_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`sequence` integer NOT NULL,
	`created_at` integer NOT NULL,
	`captured_at` integer NOT NULL,
	`edited_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_conversation_provider_message_unique` ON `messages` (`conversation_id`,`provider_message_id`);--> statement-breakpoint
CREATE INDEX `messages_conversation_sequence_index` ON `messages` (`conversation_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`repository_path` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`conversation_id` text,
	`source_message_id` text,
	`text` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `requirements_project_id_index` ON `requirements` (`project_id`);--> statement-breakpoint
CREATE INDEX `requirements_status_index` ON `requirements` (`status`);--> statement-breakpoint
CREATE TABLE `sync_checkpoints` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`last_message_sequence` integer DEFAULT 0 NOT NULL,
	`last_message_id` text,
	`last_synced_at` integer NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`conversation_id` text,
	`source_message_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`approval_status` text DEFAULT 'proposed' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_project_id_index` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_index` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_approval_status_index` ON `tasks` (`approval_status`);