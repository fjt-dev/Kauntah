// src/imageService.ts
/// <reference types="@cloudflare/workers-types" />

import type { AssetType, AnimationType } from './types.ts';
import { ASSET_DIMENSIONS } from './types.ts';
import { NORMAL_150_B64 } from './assets/normal-150.ts';
import { BLUE2_150_B64 } from './assets/blue2-150.ts';
import { GREEN_100_B64 } from './assets/green-100.ts';
import { BLUE2_100_B64 } from './assets/blue2-100.ts';
import { BLUE2_100_RULE34_B64 } from './assets/blue2-100-rule34.ts';

const ASSETS: Record<AssetType, string[]> = {
  'normal-150': NORMAL_150_B64,
  'blue2-150': BLUE2_150_B64,
  'green-100': GREEN_100_B64,
  'blue2-100': BLUE2_100_B64,
};

/**
 * 数値とアセット種別を受け取り、各桁をSVGのuseタグで横並びに配置したSVG文字列を返す。
 * paddingが指定された場合は、表示時のみ左側を0で埋める。
 */
export function buildCounterSVG(count: number, asset: AssetType, padding = 0, animation: AnimationType = 'none'): string {
  const digits = String(count).padStart(padding, '0').split('');
  const animated = asset === 'blue2-100' && animation === 'rule34';
  const assetB64 = animated ? BLUE2_100_RULE34_B64 : ASSETS[asset];
  const format = animated ? 'gif' : 'png';
  const { width, height } = ASSET_DIMENSIONS[asset];
  const totalWidth = width * digits.length;

  const uniqueDigits = [...new Set(digits)];
  const defs = uniqueDigits
    .map((d) => {
      const idx = parseInt(d, 10);
      const b64 = assetB64[idx];
      if (b64 === undefined) throw new Error(`Missing asset: ${asset}/${d}.${format}`);
      return `<image id="d${d}" x="0" y="0" width="${width}" height="${height}" href="data:image/${format};base64,${b64}"/>`;
    })
    .join('');

  const uses = digits
    .map((d, i) => `<use href="#d${d}" x="${i * width}" y="0"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}"><defs>${defs}</defs>${uses}</svg>`;
}
