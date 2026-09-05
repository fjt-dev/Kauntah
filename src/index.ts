// src/index.ts
/// <reference types="@cloudflare/workers-types" />

import { Hono } from "hono";
import { buildCounterSVG } from "./imageService.ts";
import {
  extractOwner,
  parseAssetType,
  parseAnimation,
  parseOffset,
  parsePadding,
  IMAGE_CACHE_TTL_SECONDS,
} from "./types.ts";
import { CounterDO } from "./counter.ts";

// Cloudflare Workers の環境バインディング型
export interface Env {
  /** Durable Object: アトミックカウンター */
  COUNTER: DurableObjectNamespace;
  /** Workers KV: 生成済み画像キャッシュ */
  IMAGE_CACHE: KVNamespace;
  /** Cloudflare Rate Limiting API */
  RATE_LIMITER: RateLimit;
}

// Durable Object クラスを再エクスポート（wrangler.toml の class_name と対応）
export { CounterDO };

const app = new Hono<{ Bindings: Env }>();

// ── ルート ────────────────────────────────────────────────

/**
 * GET /
 * GitHubリポジトリへ301リダイレクト。
 */
app.get("/", (c) => c.redirect("https://github.com/fjt-dev/Kauntah", 301));

/**
 * GET /counter
 * アクセスカウンター画像を返すメインエンドポイント。
 *
 * クエリパラメータ:
 *   asset  : "normal-150"（デフォルト）| "blue2-150" | "blue2-100" | "green-100"
 *   animation: "none"（デフォルト）| "rule34"（blue2-100のみ）
 *   offset : カウントに加算する値（デフォルト: 0、最大: 1,000,000）
 *   padding: 最小表示桁数（デフォルト: 指定なし、範囲: 1〜16）
 */
app.get("/counter", async (c) => {
  const env = c.env;

  // ── 1. ownerの特定 ─────────────────────────────────────
  const referer = c.req.header("referer") ?? c.req.header("referrer") ?? null;
  const owner = extractOwner(referer);

  // ── 2. クエリパラメータのパース ────────────────────────────
  const asset = parseAssetType(c.req.query("asset") ?? "");
  const animation = parseAnimation(c.req.query("animation") ?? "", asset);
  const offset = parseOffset(c.req.query("offset") ?? "");
  const padding = parsePadding(c.req.query("padding") ?? "");

  // ── 3. レート制限（カウンター水増し防止） ──────────────────
  // Cloudflare Rate Limiting API を使用。
  // DDoS・大量リクエストはCloudflare WAFがエッジで遮断するため、
  // ここでは「同一ownerに対する同一IPからのカウンター水増し」のみを対象とする。
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const rateLimitKey = JSON.stringify([owner, ip]);
  const { success: shouldIncrement } = await env.RATE_LIMITER.limit({ key: rateLimitKey });

  // ── 4. カウントの取得（Durable Object）────────────────────
  // ownerごとに固定のDOインスタンスにルーティングする。
  // idFromName は同じ文字列に対して常に同じIDを返す。
  // レート制限超過時はインクリメントせず現在値のみを取得する。
  const doId = env.COUNTER.idFromName(owner);
  const stub = env.COUNTER.get(doId);
  const operation = shouldIncrement ? "increment" : "current";
  const res = await stub.fetch(new Request(`https://do/${operation}`));
  const rawCount = await res.text();
  const count = parseInt(rawCount, 10);

  const displayCount = count + offset;

  // ── 5. SVGキャッシュの探索（Workers KV）──────────────────
  const staticCacheKey = padding === 0
    ? `svg:${asset}:${displayCount}`
    : `svg:${asset}:${displayCount}:padding:${padding}`;
  const cacheKey = animation === "none"
    ? staticCacheKey
    : `${staticCacheKey}:animation:${animation}`;
  const cached = await env.IMAGE_CACHE.get(cacheKey, "text");
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
        "X-Cache": "HIT",
        "X-Count-Incremented": String(shouldIncrement),
      },
    });
  }

  // ── 6. 動的SVG生成（キャッシュミス時）────────────────────
  const svgStr = buildCounterSVG(displayCount, asset, padding, animation);

  // KVへ非同期書き込み（レスポンスをブロックしない）
  c.executionCtx.waitUntil(
    env.IMAGE_CACHE.put(cacheKey, svgStr, {
      expirationTtl: IMAGE_CACHE_TTL_SECONDS,
    })
  );

  // ── 7. レスポンス返却 ──────────────────────────────────
  return new Response(svgStr, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
      "X-Cache": "MISS",
      "X-Count-Incremented": String(shouldIncrement),
    },
  });
});

// 未定義ルートは404
app.notFound((c) => c.text("Not Found", 404));

// 未処理例外はWorkers側でハンドリングされるが念のためログを残す
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.text("Internal Server Error", 500);
});

export default app;
