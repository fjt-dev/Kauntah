import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCounterSVG } from '../src/imageService.ts';
import { parseAssetType, ASSET_TYPES } from '../src/types.ts';

test('rule34 is an independent asset and unknown assets keep the default', () => {
  for (const asset of ASSET_TYPES) {
    assert.equal(parseAssetType(asset), asset);
    const svg = buildCounterSVG(123, asset, 4);
    assert.match(svg, new RegExp(`data:image/${asset === 'rule34' ? 'gif' : 'png'};base64,`));
  }
  for (const value of ['', 'invalid', 'RULE34', 'blue2-100-rule34']) {
    assert.equal(parseAssetType(value), 'normal-150');
  }
});

test('all ten animated digits embed the original GIF bytes and retain dimensions', () => {
  const svg = buildCounterSVG(123456789, 'rule34', 10);
  assert.match(svg, /width="450" height="100"/);
  const images = [...svg.matchAll(/<image id="d(\d)"[^>]+href="data:image\/gif;base64,([^"]+)"/g)];
  assert.equal(images.length, 10);
  for (const [, digit, data] of images) {
    const original = readFileSync(new URL(`../assets/rule34/${digit}.gif`, import.meta.url));
    assert.deepEqual(Buffer.from(data, 'base64'), original);
    assert.equal(original.readUInt16LE(6), 45);
    assert.equal(original.readUInt16LE(8), 100);
  }
  assert.equal((svg.match(/<use /g) ?? []).length, 10);
});

test('zero padding and repeated digits work in both designs with deduplicated assets', () => {
  for (const asset of ['blue2-100', 'rule34']) {
    const svg = buildCounterSVG(11, asset, 4);
    assert.match(svg, /width="180" height="100"/);
    assert.equal((svg.match(/<image /g) ?? []).length, 2);
    assert.deepEqual([...svg.matchAll(/<use href="#d(\d)" x="(\d+)"/g)].map(m => m.slice(1)),
      [['0', '0'], ['0', '45'], ['1', '90'], ['1', '135']]);
    assert.match(buildCounterSVG(0, asset, 16), /width="720" height="100"/);
  }
  assert.match(buildCounterSVG(0, 'blue2-100'), /data:image\/png;base64,/);
});
