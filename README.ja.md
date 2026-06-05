# Kauntah

[English](./README.md)

[shimobayashi/kauntah](https://github.com/shimobayashi/kauntah) に着想を得た、Cloudflare Workers で動作する TypeScript ベースのアクセスカウンター

## Preview

| asset                   | version  | preview                                                |
| ----------------------- | -------- | ------------------------------------------------------ |
| `normal-150`（default） | Ver.0.91 | ![normal-150](./assets/preview/normal-150_preview.png) |
| `blue2-150`             | Ver.0.93 | ![blue2-150](./assets/preview/blue2-150_preview.png)   |
| `blue2-100`             | Ver.0.93 | ![blue2-100](./assets/preview/blue2-100_preview.png)   |
| `green-100`             | Ver.0.93 | ![green-100](./assets/preview/green-100_preview.png)   |

## Usage

ページに以下のタグを追加するだけです。

```html
<img src="https://counter.fjtd.dev/counter" referrerpolicy="origin" />
```

### Parameters

| Parameter | Example             | Description                                                         |
| --------- | ------------------- | ------------------------------------------------------------------- |
| `asset`   | `?asset=normal-150` | `normal-150`（デフォルト）/ `blue2-150` / `green-100` / `blue2-100` |
| `offset`  | `?offset=1000`      | カウントに加算される初期値（最大：1,000,000）                       |

### Mechanism

- Referer ヘッダーのホスト名に基づいて、自動的にサイト所有者を識別します。
- ホストごとに独立したカウンターを作成します。
- 独自の FQDN を持つサイトであれば、誰でも利用可能です。

## Tech Stack

| Layer              | Technology                        | Role                                                        |
| ------------------ | --------------------------------- | ----------------------------------------------------------- |
| コンピューティング | Cloudflare Workers (Node.js 互換) | リクエスト処理                                              |
| フレームワーク     | Hono                              | ルーティング                                                |
| カウンター         | Durable Objects                   | アトミックで整合性の取れたインクリメント                    |
| 画像キャッシュ     | Workers KV                        | 生成済み PNG のキャッシュ（TTL 24時間）                     |
| 画像処理           | pngjs                             | PNG の連結（Wasm 不要）                                     |
| レート制限         | Cloudflare Rate Limiting API      | カウントの不正な水増し防止（IP あたり 30リクエスト / 60秒） |

## Notes

- レート制限：同一 IP から 60 秒間に最大 30 リクエストまで。上限を超えた場合は `429 Too Many Requests` を返します。
- 元の画像ファイルはリポジトリに含まれていますが、実行時には直接使用されません。`src/assets/` 以下に Base64 エンコードされた文字列として埋め込まれています。

## Credits

- イラスト：[日下こかげ - Twitter](https://x.com/K_KOKAGE) 氏制作。配布サイト[「KK's WS」](https://web.archive.org/web/20090831104303/http://kokagex.hp.infoseek.co.jp/)は現在閉鎖されています。
  - 詳細は「ねこみみカウンター」「日下こかげ」で検索してください。
  - 作者は非商用利用、改変、再配布を許可しています。
