import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCounterSVG } from '../src/imageService.ts';
import { parseAnimation, ASSET_TYPES } from '../src/types.ts';

test('animation is opt-in and limited to blue2-100', () => {
  for (const asset of ASSET_TYPES) {
    for (const value of ['', '0', 'none', 'true', 'rule34', '01', '1.0', ' 1', 'RULE34', '<script>']) {
      assert.equal(parseAnimation(value, asset), 'none');
    }
    assert.equal(parseAnimation('1', asset), asset === 'blue2-100' ? 'rule34' : 'none');
    if (asset !== 'blue2-100') {
      assert.equal(buildCounterSVG(123, asset, 4, 'rule34'), buildCounterSVG(123, asset, 4));
    }
  }
});

test('all ten animated digits embed the original GIF bytes and retain dimensions', () => {
  const svg = buildCounterSVG(123456789, 'blue2-100', 10, 'rule34');
  assert.match(svg, /width="450" height="100"/);
  const images = [...svg.matchAll(/<image id="d(\d)"[^>]+href="data:image\/gif;base64,([^"]+)"/g)];
  assert.equal(images.length, 10);
  for (const [, digit, data] of images) {
    const original = readFileSync(new URL(`../assets/blue2-100-rule34/${digit}.gif`, import.meta.url));
    assert.deepEqual(Buffer.from(data, 'base64'), original);
    assert.equal(original.readUInt16LE(6), 45);
    assert.equal(original.readUInt16LE(8), 100);
  }
  assert.equal((svg.match(/<use /g) ?? []).length, 10);
});

test('zero padding and repeated digits work in both modes with deduplicated assets', () => {
  for (const animation of ['none', 'rule34']) {
    const svg = buildCounterSVG(11, 'blue2-100', 4, animation);
    assert.match(svg, /width="180" height="100"/);
    assert.equal((svg.match(/<image /g) ?? []).length, 2);
    assert.deepEqual([...svg.matchAll(/<use href="#d(\d)" x="(\d+)"/g)].map(m => m.slice(1)),
      [['0', '0'], ['0', '45'], ['1', '90'], ['1', '135']]);
    assert.match(buildCounterSVG(0, 'blue2-100', 16, animation), /width="720" height="100"/);
  }
  assert.match(buildCounterSVG(0, 'blue2-100'), /data:image\/png;base64,/);
  assert.equal(buildCounterSVG(0, 'blue2-100'), buildCounterSVG(0, 'blue2-100', 0, 'none'));
});
