// Run against a local Worker started with `npm run dev -- --local`.
import assert from 'node:assert/strict';
const base = process.env.COUNTER_TEST_URL ?? 'http://localhost:8787';
const referer = `https://animation-${Date.now()}.example/`;
let requests = 0;
async function get(asset, animation, expectedCache, format) {
  requests++;
  const params = new URLSearchParams({ asset, offset: String(123 - requests), padding: '4' });
  if (animation !== undefined) params.set('animation', animation);
  const response = await fetch(`${base}/counter?${params}`, { headers: { referer } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
  assert.equal(response.headers.get('X-Count-Incremented'), 'true');
  assert.equal(response.headers.get('X-Cache'), expectedCache);
  const svg = await response.text();
  assert.match(svg, /width="180" height="100"/);
  assert.match(svg, new RegExp(`data:image/${format};base64,`));
  assert.deepEqual([...svg.matchAll(/<use href="#d(\d)"/g)].map(m => m[1]), ['0', '1', '2', '3']);
  return svg;
}
const staticSvg = await get('blue2-100', undefined, 'MISS', 'png');
const animatedSvg = await get('blue2-100', '1', 'MISS', 'gif');
assert.equal(await get('blue2-100', '1', 'HIT', 'gif'), animatedSvg);
assert.equal(await get('blue2-100', '0', 'HIT', 'png'), staticSvg);
assert.equal(await get('blue2-100', 'invalid', 'HIT', 'png'), staticSvg);
assert.equal(await get('blue2-100', 'rule34', 'HIT', 'png'), staticSvg);
const greenSvg = await get('green-100', '1', 'MISS', 'png');
assert.equal(await get('green-100', undefined, 'HIT', 'png'), greenSvg);
console.log('PASS: real Worker responses, offsets, padding, mode-specific cache MISS/HIT and fallback');
