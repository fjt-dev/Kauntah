// src/types.ts
/// <reference types="@cloudflare/workers-types" />

export type AssetType = "normal-150" | "blue2-150" | "green-100" | "blue2-100" | "rule34";

export const ASSET_TYPES: ReadonlySet<string> = new Set([
  "normal-150",
  "blue2-150",
  "green-100",
  "blue2-100",
  "rule34",
]);

export const ASSET_DIMENSIONS: Record<AssetType, { width: number; height: number }> = {
  "normal-150": { width: 68, height: 150 },
  "blue2-150":  { width: 68, height: 150 },
  "blue2-100":  { width: 45, height: 100 },
  "green-100":  { width: 45, height: 100 },
  "rule34":     { width: 45, height: 100 },
};

/** offsetの上限（意図しない巨大カウント防止）*/
export const OFFSET_MAX = 1_000_000;

/** paddingの許可範囲 */
export const PADDING_MIN = 1;
export const PADDING_MAX = 16;

/** ownerの最大長（DB肥大化・DoS防止）*/
export const OWNER_MAX_LENGTH = 253;

/** WorkerからCounterDOへ接続元IPを渡す内部ヘッダー */
export const CLIENT_IP_HEADER = "x-kauntah-client-ip";

/** KV画像キャッシュのTTL: 24時間（秒）*/
export const IMAGE_CACHE_TTL_SECONDS = 86_400;

export function parseAssetType(value: string): AssetType {
  if (
    value === "blue2-150" ||
    value === "green-100" ||
    value === "blue2-100" ||
    value === "rule34"
  ) return value;
  return "normal-150"; // デフォルト
}

export function parseOffset(value: string): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, OFFSET_MAX);
}

export function parsePadding(value: string): number {
  if (!/^\d+$/.test(value)) return 0;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < PADDING_MIN || n > PADDING_MAX) return 0;
  return n;
}

/**
 * Refererヘッダーからownerを抽出する。
 * 欠落・不正なRefererは共有ownerへ集約せずnullを返す。
 */
export function extractOwner(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const host = url.hostname;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-.]{0,251}[a-zA-Z0-9]$/.test(host)) return null;
    return host.slice(0, OWNER_MAX_LENGTH);
  } catch {
    return null;
  }
}
