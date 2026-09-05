// Run against a local Worker started with `npm run dev -- --local`.
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
const base = process.env.COUNTER_TEST_URL ?? 'http://localhost:8787';
const referer = `https://animation-${randomUUID()}.example/`;
let requests = 0;
let displayCount;
const padding = 8;
let lastCache;
async function get(asset, animation, expectedCache, format) {
  requests++;
  const params = new URLSearchParams({ asset, offset: String(displayCount - requests), padding: String(padding) });
  if (animation !== undefined) params.set('animation', animation);
  const response = await fetch(`${base}/counter?${params}`, { headers: { referer } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
  assert.equal(response.headers.get('X-Count-Incremented'), 'true');
  lastCache = response.headers.get('X-Cache');
  assert.ok(lastCache === 'MISS' || lastCache === 'HIT');
  if (expectedCache !== undefined) assert.equal(lastCache, expectedCache);
  const svg = await response.text();
  assert.match(svg, /width="360" height="100"/);
  assert.match(svg, new RegExp(`data:image/${format};base64,`));
  assert.deepEqual([...svg.matchAll(/<use href="#d(\d)"/g)].map(m => m[1]), [...String(displayCount).padStart(padding, '0')]);
  return svg;
}
// Offset is capped at 1,000,000. Probe a random value within that range,
// retrying if an earlier run already populated any of the three cache keys.
// At most 9 setup requests + 5 assertions stay below the 20-request rate limit.
let coldCache;
for (let attempt = 0; attempt < 3; attempt++) {
  displayCount = randomInt(100_000, 1_000_001);
  const staticSvg = await get('blue2-100', undefined, undefined, 'png');
  const staticCache = lastCache;
  const animatedSvg = await get('blue2-100', '1', undefined, 'gif');
  const animatedCache = lastCache;
  const greenSvg = await get('green-100', '1', undefined, 'png');
  if ([staticCache, animatedCache, lastCache].every(cache => cache === 'MISS')) {
    coldCache = { staticSvg, animatedSvg, greenSvg };
    break;
  }
}
assert.ok(coldCache, 'Could not find unused cache keys after 3 attempts');
const { staticSvg, animatedSvg, greenSvg } = coldCache;
assert.equal(await get('blue2-100', '1', 'HIT', 'gif'), animatedSvg);
assert.equal(await get('blue2-100', '0', 'HIT', 'png'), staticSvg);
assert.equal(await get('blue2-100', 'invalid', 'HIT', 'png'), staticSvg);
assert.equal(await get('blue2-100', 'rule34', 'HIT', 'png'), staticSvg);
assert.equal(await get('green-100', undefined, 'HIT', 'png'), greenSvg);
console.log('PASS: real Worker responses, offsets, padding, mode-specific cache MISS/HIT and fallback');
