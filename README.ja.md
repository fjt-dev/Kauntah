# Kauntah

[English](./README.md) | 日本語

Cloudflare Workers で動作する TypeScript ベースのアクセスカウンター

## Usage

ページに以下のタグを追加するだけです。

```html
<img src="https://counter.fjtd.dev/counter" referrerpolicy="origin" />
```

### Generator (Preview)

https://kauntah-generate.fjtd.moe/ja/

## theme

| asset                   | version  | preview                                                |
| ----------------------- | -------- | ------------------------------------------------------ |
| `normal-150`（default） | Ver.0.91 | ![normal-150](./assets/preview/normal-150_preview.png) |
| `blue2-150`             | Ver.0.93 | ![blue2-150](./assets/preview/blue2-150_preview.png)   |
| `blue2-100`             | Ver.0.93 | ![blue2-100](./assets/preview/blue2-100_preview.png)   |
| `green-100`             | Ver.0.93 | ![green-100](./assets/preview/green-100_preview.png)   |

### Parameters

| Parameter | Example             | Description                                                         |
| --------- | ------------------- | ------------------------------------------------------------------- |
| `asset`   | `?asset=normal-150` | `normal-150`（デフォルト）/ `blue2-150` / `green-100` / `blue2-100` |
| `offset`  | `?offset=1000`      | カウントに加算される初期値（最大：1,000,000）                       |
| `padding` | `?padding=4`        | 最小表示桁数（1〜16）。指定桁数まで左側を0で埋めます                |

### Mechanism

- Referer ヘッダーのホスト名に基づいて、自動的にサイト所有者を識別します。
- ホストごとに独立したカウンターを作成します。
- 独自の FQDN を持つサイトであれば、誰でも利用可能です。

## Tech Stack

| Layer              | Technology                        | Role                                                               |
| ------------------ | --------------------------------- | ------------------------------------------------------------------ |
| コンピューティング | Cloudflare Workers (Node.js 互換) | リクエスト処理                                                     |
| フレームワーク     | Hono                              | ルーティング                                                       |
| カウンター         | SQLite-backed Durable Objects     | アトミックなインクリメントと唯一の永続カウントストア               |
| 画像キャッシュ     | Workers KV                        | 生成済み SVG のキャッシュ（TTL 24時間）                            |
| 画像処理           | ネイティブ SVG レンダリング       | Base64 PNG 桁画像を SVG で合成                                     |
| レート制限         | Cloudflare Rate Limiting API      | カウントの不正な水増し防止（owner・IP あたり 20リクエスト / 60秒） |

## Notes

- レート制限：所有者とIPアドレスの組み合わせごとに、カウントは60秒間に最大20回まで増加します。制限を超えたリクエストに対しては、カウントを増やさず現在のカウンター画像が返されます。
- カウンターへのリクエストが成功するたびに、所有者のSQLiteベースのDurable Objectに対して1回の永続的な書き込みが行われます。
- デプロイする前に、`npm run check`を実行してWorkerの型チェックを行い、Wranglerがデプロイ用のバンドルをビルドできることを確認してください。
- 元の画像アセットは参照用にリポジトリに含まれていますが、実行時には直接使用されません。これらはBase64エンコードされた文字列として`src/assets/`に埋め込まれています。

## Credits

- **イラスト**: [日下こかげ (Kokage Kusaka)](https://x.com/K_KOKAGE)氏
  - 初出: ["KK's WS"](https://web.archive.org/web/20090831104303/http://kokagex.hp.infoseek.co.jp/)（現在は閉鎖）
  - 詳細については「ねこみみカウンター」および「日下こかげ」で検索してください
  - 作者により、非営利目的での使用、改変、および再配布が許可されています
