# Kauntah

[English](./README.md) | 日本語

[shimobayashi/kauntah](https://github.com/shimobayashi/kauntah) に着想を得た、Cloudflare Workers またはセルフホストの Docker サーバーで動作する TypeScript ベースのアクセスカウンター

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

## Dockerでセルフホスト

Docker Engine と Docker Compose が必要です。

```sh
cp .env.example .env
docker compose up -d --build
```

`http://localhost:3000/counter` でカウンターを利用できます。サイト別のカウンターとして動作するよう、Referer ヘッダーを付けて確認します。

```sh
curl -i -H 'Referer: https://example.com/' http://localhost:3000/counter
```

実際のページでは、ホスト名を自分のサーバーに変更して使用します。

```html
<img src="https://counter.example.com/counter" referrerpolicy="origin" />
```

カウントは Docker の `kauntah-data` ボリューム内の SQLite に保存され、コンテナを作り直しても維持されます。`docker compose down` ではボリュームを保持しますが、`docker compose down -v` を実行すると完全に削除されるので注意してください。

設定項目は `.env.example` に記載しています。信頼できるリバースプロキシの背後で動かす場合は `TRUST_PROXY=true` にすると、`X-Forwarded-For` または `X-Real-IP` の訪問者IPをレート制限に使います。クライアントが Kauntah に直接接続できる構成では、ヘッダーを偽装できるため有効にしないでください。

よく使う操作:

```sh
docker compose logs -f kauntah
docker compose restart kauntah
docker compose down
```

セルフホスト版はヘルスチェック用に `GET /healthz` を公開します。ローカル SQLite ボリュームを使う単一アプリケーションレプリカ向けの構成です。

## Tech Stack

| Layer              | Technology                        | Role                                                        |
| ------------------ | --------------------------------- | ----------------------------------------------------------- |
| コンピューティング | Cloudflare Workers または Node.js 24 | リクエスト処理                                           |
| フレームワーク     | Hono                              | ルーティング                                                |
| カウンター         | Durable Objects                   | アトミックで整合性の取れたインクリメント                    |
| 画像キャッシュ     | Workers KV                        | 生成済み SVG のキャッシュ（TTL 24時間）                     |
| 画像処理           | ネイティブ SVG レンダリング       | Base64 PNG 桁画像を SVG で合成                              |
| レート制限         | Cloudflare Rate Limiting API      | カウントの不正な水増し防止（IP あたり 30リクエスト / 60秒） |

Docker版では各 Cloudflare サービスの代わりに、アトミックで永続的なカウンターには SQLite、SVGキャッシュとレート制限にはメモリを使用します。

## Notes

- レート制限：同一 IP から 60 秒間に最大 30 リクエストまで。上限を超えた場合は `429 Too Many Requests` を返します。
- 元の画像ファイルはリポジトリに含まれていますが、実行時には直接使用されません。`src/assets/` 以下に Base64 エンコードされた文字列として埋め込まれています。

## Credits

- **イラスト**: [日下こかげ (Kokage Kusaka)](https://x.com/K_KOKAGE)氏
  - 初出: ["KK's WS"](https://web.archive.org/web/20090831104303/http://kokagex.hp.infoseek.co.jp/)（現在は閉鎖）
  - 詳細については「ねこみみカウンター」および「日下こかげ」で検索してください
  - 作者により、非営利目的での使用、改変、および再配布が許可されています
