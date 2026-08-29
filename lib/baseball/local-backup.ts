import { type AppData, normalizeAppData } from "./types";

/** 可攜式本機備份格式；版本升級時保留既有格式以維持換機還原能力。 */
export const LOCAL_BACKUP_VERSION = "bsp-local-backup-1" as const;

export type LocalBackupPayload = {
  version: typeof LOCAL_BACKUP_VERSION;
  exportedAt: string;
  appData: AppData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBackupData(value: unknown): value is Partial<AppData> {
  if (!isRecord(value)) return false;
  return Array.isArray(value.schools) && Array.isArray(value.teams) && Array.isArray(value.games);
}

export function createLocalBackupPayload(data: AppData, exportedAt = new Date().toISOString()): LocalBackupPayload {
  return { version: LOCAL_BACKUP_VERSION, exportedAt, appData: data };
}

/** 僅接受本 App 匯出的、有版本標記且含完整主要集合的 JSON 備份。 */
export function parseLocalBackup(value: string): LocalBackupPayload | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== LOCAL_BACKUP_VERSION || typeof parsed.exportedAt !== "string" || Number.isNaN(new Date(parsed.exportedAt).getTime()) || !isBackupData(parsed.appData)) {
      return undefined;
    }
    return {
      version: LOCAL_BACKUP_VERSION,
      exportedAt: parsed.exportedAt,
      appData: normalizeAppData(parsed.appData),
    };
  } catch {
    return undefined;
  }
}

export function getUtf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).byteLength;
  return Array.from(value).reduce((total, character) => total + encodeURIComponent(character).replace(/%[0-9A-F]{2}/gi, "x").length, 0);
}

export function formatLocalStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 || Number.isInteger(value) || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function formatLocalSavedAt(value: string | null | undefined): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return "尚未完成首次保存";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function getLocalBackupFileName(exportedAt: string): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, "-");
  return `baseball-scorer-pro-backup-${safeTimestamp}.json`;
}
