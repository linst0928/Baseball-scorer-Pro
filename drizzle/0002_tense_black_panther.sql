ALTER TABLE `game_snapshots` ADD `revision` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_snapshots` ADD `clientId` varchar(128);