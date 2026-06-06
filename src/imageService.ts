// src/imageService.ts
/// <reference types="@cloudflare/workers-types" />

import type { AssetType } from './types.ts';
import { ASSET_DIMENSIONS } from './types.ts';
import { NORMAL_150_B64 } from './assets/normal-150.ts';
import { BLUE2_150_B64 } from './assets/blue2-150.ts';
import { GREEN_100_B64 } from './assets/green-100.ts';
import { BLUE2_100_B64 } from './assets/blue2-100.ts';

const ASSETS: Record<AssetType, string[]> = {
  'normal-150': NORMAL_150_B64,
  'blue2-150': BLUE2_150_B64,
  'green-100': GREEN_100_B64,
  'blue2-100': BLUE2_100_B64,
};

/**
 * 数値とアセット種別を受け取り、各桁をSVGのuseタグで横並びに配置したSVG文字列を返す。
 */
export function buildCounterSVG(count: number, asset: AssetType): string {
  const digits = String(count).split('');
  const assetB64 = ASSETS[asset];
  const { width, height } = ASSET_DIMENSIONS[asset];
  const totalWidth = width * digits.length;

  const defs = digits
    .map((d, i) => {
      const idx = parseInt(d, 10);
      const b64 = assetB64[idx];
      if (b64 === undefined) throw new Error(`Missing asset: ${asset}/${d}.png`);
      return `<image id="d${i}" x="0" y="0" width="${width}" height="${height}" href="data:image/png;base64,${b64}"/>`;
    })
    .join('');

  const uses = digits
    .map((_, i) => `<use href="#d${i}" x="${i * width}" y="0"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}"><defs>${defs}</defs>${uses}</svg>`;
}
