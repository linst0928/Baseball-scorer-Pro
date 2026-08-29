import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { GameSnapshot, InsertGameSnapshot, InsertUser, gameSnapshots, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      const normalized = user[field] ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGameSnapshot(userId: number, snapshotKey = "default"): Promise<GameSnapshot | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gameSnapshots).where(eq(gameSnapshots.userId, userId)).limit(1);
  return result.find((snapshot) => snapshot.snapshotKey === snapshotKey);
}

export type SnapshotSaveResult =
  | { status: "saved"; snapshot: GameSnapshot }
  | { status: "conflict"; snapshot: GameSnapshot };

export async function upsertGameSnapshot(
  userId: number,
  payload: string,
  snapshotKey = "default",
  options: { baseUpdatedAt?: string; clientId?: string; force?: boolean } = {},
): Promise<SnapshotSaveResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getGameSnapshot(userId, snapshotKey);
  if (existing && options.baseUpdatedAt) {
    const baseTime = new Date(options.baseUpdatedAt).getTime();
    const remoteTime = new Date(existing.updatedAt).getTime();
    if (!options.force && Number.isFinite(baseTime) && Number.isFinite(remoteTime) && remoteTime > baseTime) {
      return { status: "conflict", snapshot: existing };
    }
  }

  if (existing) {
    await db.update(gameSnapshots).set({
      payload,
      revision: (existing.revision ?? 0) + 1,
      clientId: options.clientId ?? null,
      updatedAt: new Date(),
    }).where(eq(gameSnapshots.id, existing.id));
  } else {
    const values: InsertGameSnapshot = { userId, snapshotKey, payload, revision: 1, clientId: options.clientId ?? null };
    await db.insert(gameSnapshots).values(values);
  }
  const snapshot = await getGameSnapshot(userId, snapshotKey);
  if (!snapshot) throw new Error("Snapshot was not persisted");
  return { status: "saved", snapshot };
}
