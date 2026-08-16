import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Hono } from "hono";
import { buildCounterSVG } from "./imageService.ts";
import {
  CounterStore,
  FixedWindowRateLimiter,
  SvgCache,
  forwardedClientIp,
  loadConfig,
} from "./selfhost.ts";
import { extractOwner, parseAssetType, parseOffset } from "./types.ts";

const config = loadConfig();
const counters = new CounterStore(config.dataDir);
const rateLimiter = new FixedWindowRateLimiter(
  config.rateLimitMax,
  config.rateLimitWindowSeconds * 1000,
);
const imageCache = new SvgCache(
  config.imageCacheMaxEntries,
  config.imageCacheTtlSeconds * 1000,
);

const app = new Hono();

app.get("/", (c) => c.redirect("https://github.com/fjt-dev/Kauntah", 301));

app.get("/healthz", (c) => c.json({ status: "ok" }));

app.get("/counter", (c) => {
  const directIp = getConnInfo(c).remote.address;
  const clientIp = config.trustProxy
    ? forwardedClientIp(c.req.header("x-forwarded-for"), c.req.header("x-real-ip")) ?? directIp
    : directIp;
  const rateLimit = rateLimiter.consume(clientIp || "unknown");

  if (!rateLimit.allowed) {
    return c.text("Too Many Requests", 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const referer = c.req.header("referer") ?? c.req.header("referrer") ?? null;
  const owner = extractOwner(referer);
  const asset = parseAssetType(c.req.query("asset") ?? "");
  const offset = parseOffset(c.req.query("offset") ?? "");
  const displayCount = counters.increment(owner) + offset;
  const cacheKey = `svg:${asset}:${displayCount}`;
  const cached = imageCache.get(cacheKey);

  if (cached) {
    return c.body(cached, 200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
      "X-Cache": "HIT",
    });
  }

  const svg = buildCounterSVG(displayCount, asset);
  imageCache.set(cacheKey, svg);
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store",
    "X-Cache": "MISS",
  });
});

app.notFound((c) => c.text("Not Found", 404));
app.onError((error, c) => {
  console.error("Unhandled error:", error);
  return c.text("Internal Server Error", 500);
});

const server = serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  console.log(`Kauntah listening on http://${config.host}:${info.port}`);
});

const pruneTimer = setInterval(
  () => rateLimiter.prune(),
  Math.max(config.rateLimitWindowSeconds * 1000, 60_000),
);
pruneTimer.unref();

function shutdown(signal: string): void {
  console.log(`${signal} received; shutting down`);
  clearInterval(pruneTimer);
  server.close(() => {
    counters.close();
    process.exit(0);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

