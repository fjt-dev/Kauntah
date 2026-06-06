// src/index.ts
/// <reference types="@cloudflare/workers-types" />

import { Hono } from "hono";
import { buildCounterSVG } from "./imageService.ts";
import { extractOwner, parseAssetType, parseOffset, IMAGE_CACHE_TTL_SECONDS } from "./types.ts";
import { CounterDO } from "./counter.ts";

// Cloudflare Workers の環境バインディング型
export interface Env {
  /** Durable Object: アトミックカウンター */
  COUNTER: DurableObjectNamespace;
  /** Workers KV: 生成済み画像キャッシュ */
  IMAGE_CACHE: KVNamespace;
  /** Cloudflare Rate Limiting API */
  RATE_LIMITER: RateLimit;
  /** D1: カウントバックアップ */
  DB: D1Database;
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
 *   offset : カウントに加算する値（デフォルト: 0、最大: 1,000,000）
 */
app.get("/counter", async (c) => {
  const env = c.env;

  // ── 1. レート制限（カウンター水増し防止） ──────────────────
  // Cloudflare Rate Limiting API を使用。
  // DDoS・大量リクエストはCloudflare WAFがエッジで遮断するため、
  // ここでは「同一IPによるカウンター水増し」のみを対象とする。
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return c.text("Too Many Requests", 429);
  }

  // ── 2. ownerの特定 ─────────────────────────────────────
  const referer = c.req.header("referer") ?? c.req.header("referrer") ?? null;
  const owner = extractOwner(referer);
  // ── 3. クエリパラメータのパース ────────────────────────────
  const asset = parseAssetType(c.req.query("asset") ?? "");
  const offset = parseOffset(c.req.query("offset") ?? "");

  // ── 4. カウントのインクリメント（Durable Object）─────────────
  // ownerごとに固定のDOインスタンスにルーティングする。
  // idFromName は同じ文字列に対して常に同じIDを返す。
  const doId = env.COUNTER.idFromName(owner);
  const stub = env.COUNTER.get(doId);
  const res = await stub.fetch(new Request("https://do/"));
  const rawCount = await res.text();
  const count = parseInt(rawCount, 10);

  const displayCount = count + offset;

  // D1にカウントをバックアップ（キャッシュHIT/MISSに関わらず常に実行）
  c.executionCtx.waitUntil(
    env.DB.prepare(
      "INSERT INTO counters (owner, count) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET count = excluded.count"
    ).bind(owner, count).run()
  );

  // ── 5. SVGキャッシュの探索（Workers KV）──────────────────
  const cacheKey = `svg:${asset}:${displayCount}`;
  const cached = await env.IMAGE_CACHE.get(cacheKey, "text");
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
        "X-Cache": "HIT",
      },
    });
  }

  // ── 6. 動的SVG生成（キャッシュミス時）────────────────────
  const svgStr = buildCounterSVG(displayCount, asset);

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
