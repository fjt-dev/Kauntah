// src/imageService.ts
//
// pngjs/browser を使って数字PNGを横結合する。
// アセットはbase64でインライン埋め込み済み（src/assets/ 以下）。
/// <reference types="@cloudflare/workers-types" />

import { PNG } from 'pngjs/browser';
import type { AssetType } from './types.ts';
import { NORMAL_150_B64 } from './assets/normal-150.ts';
import { BLUE2_150_B64 } from './assets/blue2-150.ts';
import { GREEN_100_B64 } from './assets/green-100.ts';
import { BLUE2_100_B64 } from './assets/blue2-100.ts';

const ASSETS: Record<AssetType, string[]> = {
  'normal-150': NORMAL_150_B64,
  'blue2-150': BLUE2_150_B64,
  'green-100': GREEN_100_B64,
  'blue2-100': BLUE2_100_B64
};

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function decodePng(buffer: ArrayBuffer): PNG {
  return PNG.sync.read(Buffer.from(buffer));
}

/**
 * 数値とアセット種別を受け取り、各桁PNGを横結合したUint8Arrayを返す。
 */
export function buildCounterImage(count: number, asset: AssetType): Uint8Array {
  const digits = String(count).split('');
  const assetB64 = ASSETS[asset];

  const frames = digits.map((d) => {
    const idx = parseInt(d, 10);
    const b64 = assetB64[idx];
    if (b64 === undefined) throw new Error(`Missing asset: ${asset}/${d}.png`);
    return decodePng(b64ToArrayBuffer(b64));
  });

  const totalWidth = frames.reduce((sum, f) => sum + f.width, 0);
  const totalHeight = Math.max(...frames.map((f) => f.height));

  const canvas = new PNG({ width: totalWidth, height: totalHeight });
  canvas.data = Buffer.alloc(totalWidth * totalHeight * 4, 0);

  let offsetX = 0;
  for (const frame of frames) {
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const srcIdx = (y * frame.width + x) * 4;
        const dstIdx = (y * totalWidth + (offsetX + x)) * 4;
        canvas.data[dstIdx]! = frame.data[srcIdx]!;
        canvas.data[dstIdx + 1]! = frame.data[srcIdx + 1]!;
        canvas.data[dstIdx + 2]! = frame.data[srcIdx + 2]!;
        canvas.data[dstIdx + 3]! = frame.data[srcIdx + 3]!;
      }
    }
    offsetX += frame.width;
  }

  return PNG.sync.write(canvas);
}
