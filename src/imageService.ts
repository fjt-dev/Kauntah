// src/imageService.ts
//
/// <reference types="@cloudflare/workers-types" />
// pngjs を使って数字PNGを横結合する。
// sharp / Wasm 不要で、Workers の軽量性を維持する。
//
// アセット読み込み:
//   wrangler.toml の [[rules]] type="Data" により、
//   PNG ファイルは ArrayBuffer として静的インポートできる。
//
// PNG合成の仕組み:
//   1. 各桁のPNGバイナリをデコード
//   2. 合計幅 × 最大高さのキャンバスを作成（RGBA=0で初期化）
//   3. 各桁画像を左から順にピクセルコピー
//   4. PNGとしてエンコードして返す

import { PNG } from "pngjs";
import type { AssetType } from "./types.ts";

// ── nekomimi（GIFから変換済みPNG）──────────────────────────
import nekomimi0 from "../assets/nekomimi/0.png";
import nekomimi1 from "../assets/nekomimi/1.png";
import nekomimi2 from "../assets/nekomimi/2.png";
import nekomimi3 from "../assets/nekomimi/3.png";
import nekomimi4 from "../assets/nekomimi/4.png";
import nekomimi5 from "../assets/nekomimi/5.png";
import nekomimi6 from "../assets/nekomimi/6.png";
import nekomimi7 from "../assets/nekomimi/7.png";
import nekomimi8 from "../assets/nekomimi/8.png";
import nekomimi9 from "../assets/nekomimi/9.png";

// ── blue ───────────────────────────────────────────────
import blue0 from "../assets/blue/0.png";
import blue1 from "../assets/blue/1.png";
import blue2 from "../assets/blue/2.png";
import blue3 from "../assets/blue/3.png";
import blue4 from "../assets/blue/4.png";
import blue5 from "../assets/blue/5.png";
import blue6 from "../assets/blue/6.png";
import blue7 from "../assets/blue/7.png";
import blue8 from "../assets/blue/8.png";
import blue9 from "../assets/blue/9.png";

// ── color ──────────────────────────────────────────────
import color0 from "../assets/color/0.png";
import color1 from "../assets/color/1.png";
import color2 from "../assets/color/2.png";
import color3 from "../assets/color/3.png";
import color4 from "../assets/color/4.png";
import color5 from "../assets/color/5.png";
import color6 from "../assets/color/6.png";
import color7 from "../assets/color/7.png";
import color8 from "../assets/color/8.png";
import color9 from "../assets/color/9.png";

const ASSETS: Record<AssetType, ArrayBuffer[]> = {
  nekomimi: [nekomimi0, nekomimi1, nekomimi2, nekomimi3, nekomimi4,
             nekomimi5, nekomimi6, nekomimi7, nekomimi8, nekomimi9],
  blue:     [blue0, blue1, blue2, blue3, blue4,
             blue5, blue6, blue7, blue8, blue9],
  color:    [color0, color1, color2, color3, color4,
             color5, color6, color7, color8, color9],
};

/**
 * ArrayBuffer → pngjs PNG オブジェクト
 */
function decodePng(buffer: ArrayBuffer): PNG {
  return PNG.sync.read(Buffer.from(buffer));
}

/**
 * 数値とアセット種別を受け取り、各桁PNGを横結合したUint8Arrayを返す。
 */
export function buildCounterImage(count: number, asset: AssetType): Uint8Array {
  const digits = String(count).split("");
  const assetBuffers = ASSETS[asset];

  // 各桁のPNGをデコード
  const frames = digits.map((d) => {
    const idx = parseInt(d, 10);
    const buf = assetBuffers[idx];
    if (buf === undefined) throw new Error(`Missing asset: ${asset}/${d}.png`);
    return decodePng(buf);
  });

  const totalWidth = frames.reduce((sum, f) => sum + f.width, 0);
  const totalHeight = Math.max(...frames.map((f) => f.height));

  // キャンバス作成（RGBA 4チャンネル、完全透明で初期化）
  const canvas = new PNG({ width: totalWidth, height: totalHeight });
  canvas.data = Buffer.alloc(totalWidth * totalHeight * 4, 0);

  // 各桁をキャンバスへ左から順にピクセルコピー
  let offsetX = 0;
  for (const frame of frames) {
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const srcIdx = (y * frame.width + x) * 4;
        const dstIdx = (y * totalWidth + (offsetX + x)) * 4;
        canvas.data[dstIdx]!     = frame.data[srcIdx]!;
        canvas.data[dstIdx + 1]! = frame.data[srcIdx + 1]!;
        canvas.data[dstIdx + 2]! = frame.data[srcIdx + 2]!;
        canvas.data[dstIdx + 3]! = frame.data[srcIdx + 3]!;
      }
    }
    offsetX += frame.width;
  }

  return PNG.sync.write(canvas);
}
