# Kauntah

[English](./README.md)

[shimobayashi/kauntah](https://github.com/shimobayashi/kauntah) に着想を得た、Cloudflare Workers 上で動作する TypeScript 製ヒットカウンターです。

オリジナルのコンセプト（`<img>` タグ1行埋め込むだけのアクセスカウンター）とねこ耳数字アセットはそのままに、Cloudflare のエッジネットワーク向けに書き直しました。アトミックなカウンター、画像キャッシュ、レート制限を備えています。

## プレビュー

| asset                    | プレビュー                                            |
| ------------------------ | ----------------------------------------------------- |
| `nekomimi`（デフォルト） | ![nekomimi](./assets/preview/nekomimi_preview.png)    |
| `blue`                   | ![blue](./assets/preview/nekomimi_preview_blue.png)   |
| `color`                  | ![color](./assets/preview/nekomimi_preview_color.png) |

## 使い方

自分のページに以下のタグを追加するだけです：

```html
<img src="https://counter.fjtd.dev/counter" />
```

### パラメータ

| パラメータ | 例                | 説明                                        |
| ---------- | ----------------- | ------------------------------------------- |
| `asset`    | `?asset=nekomimi` | `nekomimi`（デフォルト）/ `blue` / `color`  |
| `offset`   | `?offset=1000`    | カウントに加算する初期値（最大: 1,000,000） |

### 仕組み

- Referer ヘッダーのホスト名をオーナーとして自動識別
- ホストごとに独立したカウンターが作成される
- 自分の FQDN を持つサイトであれば誰でも利用可能

## 技術スタック

| レイヤー       | 技術                               | 役割                                       |
| -------------- | ---------------------------------- | ------------------------------------------ |
| Compute        | Cloudflare Workers（Node.js 互換） | リクエスト処理                             |
| Framework      | Hono                               | ルーティング                               |
| カウンター     | Durable Objects                    | アトミックで強整合性のあるインクリメント   |
| 画像キャッシュ | Workers KV                         | 生成済み PNG キャッシュ（24時間 TTL）      |
| 画像処理       | pngjs                              | PNG 横結合（Wasm 不要）                    |
| レート制限     | Cloudflare Rate Limiting API       | カウンター水増し防止（30回 / 60秒 per IP） |
| DDoS 対策      | Cloudflare WAF                     | エッジで自動遮断                           |

## デプロイ

Workers と Durable Objects が有効な Cloudflare アカウントが必要です。

1. `npm install`
2. `npx wrangler login`
3. KV namespace を作成し、`id` を `wrangler.toml` に記入
4. `npm run deploy`

## ディレクトリ構成

```
kauntah/
├── src/
│   ├── index.ts          # Hono エントリポイント・メインロジック
│   ├── counter.ts        # Durable Object（アトミックカウンター）
│   ├── imageService.ts   # pngjs による PNG 横結合
│   └── types.ts          # 型定義・定数・バリデーション関数
├── assets/
│   ├── nekomimi/         # 0〜9.png
│   ├── blue/             # 0〜9.png
│   └── color/            # 0〜9.png
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## 注意事項

- レート制限: 同一 IP から 60 秒間に 30 リクエストまで。超過した場合は `429 Too Many Requests` を返します。

## Credits

- ねこみみ画像: [日下こかげ](http://www.pixiv.net/member.php?id=11807) さんによる作品。配布サイト「KK's WS」は現在閉鎖されています。
  - 詳細は「ねこみみカウンタ」「日下こかげ」で検索してください。
  - 作者より商用以外の利用・改変・再配布が許可されています。
