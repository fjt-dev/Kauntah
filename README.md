# Kauntah

English | [日本語](./README.ja.md)

A TypeScript-based hit counter running on Cloudflare Workers.

## Usage

Simply add the following tag to your page:

```html
<img src="https://counter.fjtd.dev/counter" referrerpolicy="origin" />
```

### Generator (Preview)

https://kauntah-generate.fjtd.moe/

## theme

| asset                  | version  | preview                                                |
| ---------------------- | -------- | ------------------------------------------------------ |
| `normal-150` (default) | Ver.0.91 | ![normal-150](./assets/preview/normal-150_preview.png) |
| `blue2-150`            | Ver.0.93 | ![blue2-150](./assets/preview/blue2-150_preview.png)   |
| `blue2-100`            | Ver.0.93 | ![blue2-100](./assets/preview/blue2-100_preview.png)   |
| `green-100`            | Ver.0.93 | ![green-100](./assets/preview/green-100_preview.png)   |

### Parameters

| Parameter | Example             | Description                                                      |
| --------- | ------------------- | ---------------------------------------------------------------- |
| `asset`   | `?asset=normal-150` | `normal-150` (default) / `blue2-150` / `green-100` / `blue2-100` |
| `offset`  | `?offset=1000`      | Initial value added to the count (max: 1,000,000)                |
| `padding` | `?padding=4`        | Minimum display digits (1–16); pads with leading zeros           |

### Mechanism

- Automatically identifies the owner based on the hostname of the Referer header.
- Creates an independent counter for each host.
- Available for use by anyone with a site that has its own FQDN.

## Tech Stack

| Layer            | Technology                              | Role                                                                 |
| ---------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Compute          | Cloudflare Workers (Node.js compatible) | Request handling                                                     |
| Framework        | Hono                                    | Routing                                                              |
| Counter          | SQLite-backed Durable Objects           | Atomic increment and the sole persistent count store                 |
| Image Cache      | Workers KV                              | Generated SVG cache (24-hour TTL)                                    |
| Image Processing | Native SVG rendering                    | Combines Base64 PNG digit assets in SVG                              |
| Rate Limiting    | Cloudflare Rate Limiting API            | Prevents count inflation (20 requests / 60 seconds per owner and IP) |

## Notes

- Rate limiting: The count increases up to 20 times per 60 seconds for each owner and IP combination. Requests above the limit return the current counter image without increasing the count.
- Each successful counter request performs one persistent write to its owner's SQLite-backed Durable Object.
- Before deploying, run `npm run check` to type-check the Worker and verify that Wrangler can build its deployment bundle.
- The original asset images are included in the repository for reference, but are not used directly at runtime. They are embedded as Base64-encoded strings in `src/assets/`.

## Credits

- **Illustration**: [Kokage Kusaka (日下こかげ)](https://x.com/K_KOKAGE)
  - Originally distributed on ["KK's WS"](https://web.archive.org/web/20090831104303/http://kokagex.hp.infoseek.co.jp/) (now closed)
  - For more details, search for "Nekomimi Counter" and "Kokage Kusaka"
  - Non-commercial use, modification, and redistribution are permitted by the author
