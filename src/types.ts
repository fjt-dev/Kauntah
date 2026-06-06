// src/types.ts
/// <reference types="@cloudflare/workers-types" />

export type AssetType = "normal-150" | "blue2-150" | "green-100" | "blue2-100";

export const ASSET_TYPES: ReadonlySet<string> = new Set([
  "normal-150",
  "blue2-150",
  "green-100",
  "blue2-100",
]);

export const ASSET_DIMENSIONS: Record<AssetType, { width: number; height: number }> = {
  "normal-150": { width: 68, height: 150 },
  "blue2-150":  { width: 68, height: 150 },
  "blue2-100":  { width: 45, height: 100 },
  "green-100":  { width: 45, height: 100 },
};

/** offsetの上限（意図しない巨大カウント防止）*/
export const OFFSET_MAX = 1_000_000;

/** ownerの最大長（DB肥大化・DoS防止）*/
export const OWNER_MAX_LENGTH = 253;

/** KV画像キャッシュのTTL: 24時間（秒）*/
export const IMAGE_CACHE_TTL_SECONDS = 86_400;

export function parseAssetType(value: string): AssetType {
  if (
    value === "blue2-150" ||
    value === "green-100" ||
    value === "blue2-100"
  ) return value;
  return "normal-150"; // デフォルト
}

export function parseOffset(value: string): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, OFFSET_MAX);
}

/**
 * Refererヘッダーからownerを抽出する。
 */
export function extractOwner(referer: string | null): string {
  if (!referer) return "unknown";
  try {
    const url = new URL(referer);
    const host = url.hostname;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-.]{0,251}[a-zA-Z0-9]$/.test(host)) return "unknown";
    return host.slice(0, OWNER_MAX_LENGTH);
  } catch {
    return "unknown";
  }
}
