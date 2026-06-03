# Kauntah

[English](./README.md)

[shimobayashi/kauntah](https://github.com/shimobayashi/kauntah) に着想を得た、Cloudflare Workers で動作する TypeScript ベースのアクセスカウンターです。

Cloudflare Workers上で動作するヒットカウンターです。`<img>`タグを1つ埋め込むだけで利用できます。アトミックカウンター、画像キャッシュ、レート制限の機能を備えています。

## プレビュー

| アセット                | プレビュー                                            |
| ----------------------- | ----------------------------------------------------- |
| `nekomimi` (デフォルト) | ![nekomimi](./assets/preview/nekomimi_preview.png)    |
| `blue`                  | ![blue](./assets/preview/nekomimi_preview_blue.png)   |
| `color`                 | ![color](./assets/preview/nekomimi_preview_color.png) |

## 使い方

ページに以下のタグを追加するだけです。

```html
<img src="https://counter.fjtd.dev/counter" />
```

### パラメータ

| パラメータ | 例                | 説明                                          |
| ---------- | ----------------- | --------------------------------------------- |
| `asset`    | `?asset=nekomimi` | `nekomimi` (デフォルト) / `blue` / `color`    |
| `offset`   | `?offset=1000`    | カウントに加算される初期値（最大：1,000,000） |

### 仕組み

- Referer ヘッダーのホスト名に基づいて、自動的にサイト所有者を識別します。
- ホストごとに独立したカウンターを作成します。
- 独自の FQDN を持つサイトであれば、誰でも利用可能です。

## 技術スタック

| レイヤー           | 技術                              | 役割                                                        |
| ------------------ | --------------------------------- | ----------------------------------------------------------- |
| コンピューティング | Cloudflare Workers (Node.js 互換) | リクエスト処理                                              |
| フレームワーク     | Hono                              | ルーティング                                                |
| カウンター         | Durable Objects                   | アトミックで整合性の取れたインクリメント                    |
| 画像キャッシュ     | Workers KV                        | 生成済み PNG のキャッシュ（TTL 24時間）                     |
| 画像処理           | pngjs                             | PNG の連結（Wasm 不要）                                     |
| レート制限         | Cloudflare Rate Limiting API      | カウントの不正な水増し防止（IP あたり 30リクエスト / 60秒） |
| DDoS 対策          | Cloudflare WAF                    | エッジでの自動ブロック                                      |

## デプロイ方法

Workers と Durable Objects が有効な Cloudflare アカウントが必要です。

1. `npm install`
2. `npx wrangler login`
3. KV 名前空間を作成し、その `id` を `wrangler.toml` に入力
4. `npm run deploy`

## ディレクトリ構造

```
kauntah/
├── src/
│   ├── index.ts          # Hono エントリーポイントおよびメインロジック
│   ├── counter.ts        # Durable Object（アトミックカウンター）
│   ├── imageService.ts   # pngjs を使用した PNG 連結
│   └── types.ts          # 型定義、定数、バリデーション関数
├── assets/
│   ├── nekomimi/         # 0-9.png
│   ├── blue/             # 0-9.png
│   └── color/            # 0-9.png
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## 注意点

- レート制限：同一 IP から 60 秒間に最大 30 リクエストまで。上限を超えた場合は `429 Too Many Requests` を返します。

## クレジット

- ねこみみ画像：[日下こかげ](http://www.pixiv.net/member.php?id=11807) 氏制作。配布サイト「KK's WS」は現在閉鎖されています。
  - 詳細は「ねこみみカウンター」「日下こかげ」で検索してください。
  - 作者は非商用利用、改変、再配布を許可しています。
