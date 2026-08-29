CREATE TABLE `game_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotKey` varchar(64) NOT NULL DEFAULT 'default',
	`payload` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_snapshot_user_key_idx` UNIQUE(`userId`,`snapshotKey`)
);
