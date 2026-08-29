import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * One JSON snapshot per user keeps the live scoring workflow fast and allows
 * future migrations to normalize teams, games and pitch events independently.
 */
export const gameSnapshots = mysqlTable("game_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshotKey: varchar("snapshotKey", { length: 64 }).notNull().default("default"),
  payload: text("payload").notNull(),
  revision: int("revision").default(1).notNull(),
  clientId: varchar("clientId", { length: 128 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userSnapshotKey: uniqueIndex("game_snapshot_user_key_idx").on(table.userId, table.snapshotKey),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type GameSnapshot = typeof gameSnapshots.$inferSelect;
export type InsertGameSnapshot = typeof gameSnapshots.$inferInsert;
