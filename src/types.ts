// src/types.ts
/// <reference types="@cloudflare/workers-types" />

export type AssetType = "nekomimi" | "blue" | "color";

export const ASSET_TYPES: ReadonlySet<string> = new Set(["nekomimi", "blue", "color"]);

export const ASSET_EXT: Record<AssetType, string> = {
  nekomimi: "png", // GIFから変換済みPNG
  blue: "png",
  color: "png",
};

/** offsetの上限（意図しない巨大カウント防止）*/
export const OFFSET_MAX = 1_000_000;

/** ownerの最大長（DB肥大化・DoS防止）*/
export const OWNER_MAX_LENGTH = 253;

/** KV画像キャッシュのTTL: 24時間（秒）*/
export const IMAGE_CACHE_TTL_SECONDS = 86_400;

export function parseAssetType(value: string): AssetType {
  if (value === "blue" || value === "color") return value;
  return "nekomimi";
}

export function parseOffset(value: string): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, OFFSET_MAX);
}

/**
 * Refererヘッダーからownerを抽出する。
 * - 正常: "https://example.com/path" → "example.com"
 * - 不正・未設定: "unknown"
 */
export function extractOwner(referer: string | null): string {
  if (!referer) return "unknown";
  try {
    const url = new URL(referer);
    const host = url.hostname;
    // ドット区切りのFQDN形式のみ許容（IPアドレス直打ち等は unknown 扱い）
    if (!/^[a-zA-Z0-9][a-zA-Z0-9\-.]{0,251}[a-zA-Z0-9]$/.test(host)) return "unknown";
    return host.slice(0, OWNER_MAX_LENGTH);
  } catch {
    return "unknown";
  }
}
