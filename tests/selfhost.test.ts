import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CounterStore,
  FixedWindowRateLimiter,
  SvgCache,
  forwardedClientIp,
  loadConfig,
} from "../src/selfhost.ts";

test("CounterStore persists independent counters by owner", () => {
  const directory = mkdtempSync(join(tmpdir(), "kauntah-test-"));
  try {
    const first = new CounterStore(directory);
    assert.equal(first.increment("example.com"), 1);
    assert.equal(first.increment("example.com"), 2);
    assert.equal(first.increment("other.example"), 1);
    first.close();

    const reopened = new CounterStore(directory);
    assert.equal(reopened.increment("example.com"), 3);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("FixedWindowRateLimiter blocks requests until the window resets", () => {
  const limiter = new FixedWindowRateLimiter(2, 1_000);
  assert.equal(limiter.consume("client", 1_000).allowed, true);
  assert.equal(limiter.consume("client", 1_100).allowed, true);
  assert.deepEqual(limiter.consume("client", 1_200), {
    allowed: false,
    retryAfterSeconds: 1,
  });
  assert.equal(limiter.consume("client", 2_000).allowed, true);
});

test("SvgCache expires entries and evicts the oldest entry", () => {
  const cache = new SvgCache(1, 1_000);
  cache.set("one", "first", 1_000);
  cache.set("two", "second", 1_100);
  assert.equal(cache.get("one", 1_100), undefined);
  assert.equal(cache.get("two", 1_999), "second");
  assert.equal(cache.get("two", 2_100), undefined);
});

test("proxy and environment helpers use safe defaults", () => {
  assert.equal(forwardedClientIp("203.0.113.1, 10.0.0.1", undefined), "203.0.113.1");
  assert.equal(forwardedClientIp(undefined, "198.51.100.2"), "198.51.100.2");
  const config = loadConfig({ PORT: "invalid", RATE_LIMIT_MAX: "0", TRUST_PROXY: "TRUE" });
  assert.equal(config.port, 3000);
  assert.equal(config.rateLimitMax, 30);
  assert.equal(config.trustProxy, true);
});
