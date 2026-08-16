# Kauntah

[![CI](https://github.com/fjt-dev/Kauntah/actions/workflows/ci.yml/badge.svg)](https://github.com/fjt-dev/Kauntah/actions/workflows/ci.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey.svg)](./LICENSE)

English | [日本語](./README.ja.md)

A TypeScript-based hit counter for Cloudflare Workers or a self-hosted Docker server, inspired by [shimobayashi/kauntah](https://github.com/shimobayashi/kauntah).

## Preview

| asset                  | version  | preview                                                |
| ---------------------- | -------- | ------------------------------------------------------ |
| `normal-150` (default) | Ver.0.91 | ![normal-150](./assets/preview/normal-150_preview.png) |
| `blue2-150`            | Ver.0.93 | ![blue2-150](./assets/preview/blue2-150_preview.png)   |
| `blue2-100`            | Ver.0.93 | ![blue2-100](./assets/preview/blue2-100_preview.png)   |
| `green-100`            | Ver.0.93 | ![green-100](./assets/preview/green-100_preview.png)   |

## Usage

Simply add the following tag to your page:

```html
<img src="https://counter.fjtd.dev/counter" referrerpolicy="origin" />
```

### Parameters

| Parameter | Example             | Description                                                      |
| --------- | ------------------- | ---------------------------------------------------------------- |
| `asset`   | `?asset=normal-150` | `normal-150` (default) / `blue2-150` / `green-100` / `blue2-100` |
| `offset`  | `?offset=1000`      | Initial value added to the count (max: 1,000,000)                |

### Mechanism

- Automatically identifies the owner based on the hostname of the Referer header.
- Creates an independent counter for each host.
- Available for use by anyone with a site that has its own FQDN.

## Self-host with Docker

Requirements: Docker Engine with Docker Compose.

```sh
cp .env.example .env
docker compose up -d --build
```

The counter is now available at `http://localhost:3000/counter`. Test it with a Referer header so the request uses its own site counter:

```sh
curl -i -H 'Referer: https://example.com/' http://localhost:3000/counter
```

Use it from a page by changing the host name to your server:

```html
<img src="https://counter.example.com/counter" referrerpolicy="origin" />
```

Counts are stored in SQLite in the `kauntah-data` Docker volume and survive container recreation. `docker compose down` keeps this volume; `docker compose down -v` permanently deletes it.

Configuration is documented in `.env.example`. When Kauntah is behind a trusted reverse proxy, set `TRUST_PROXY=true` so rate limiting uses the visitor IP forwarded in `X-Forwarded-For` or `X-Real-IP`. Do not enable it when clients can connect to Kauntah directly, because those headers can then be spoofed.

Useful commands:

```sh
docker compose logs -f kauntah
docker compose restart kauntah
docker compose down
```

The self-hosted server exposes `GET /healthz` for health checks. It is designed to run as one application replica with its local SQLite volume.

## Tech Stack

| Layer            | Technology                              | Role                                                       |
| ---------------- | --------------------------------------- | ---------------------------------------------------------- |
| Compute          | Cloudflare Workers or Node.js 24        | Request handling                                           |
| Framework        | Hono                                    | Routing                                                    |
| Counter          | Durable Objects                         | Atomic and strongly consistent increment                   |
| Image Cache      | Workers KV                              | Generated SVG cache (24-hour TTL)                          |
| Image Processing | Native SVG rendering                    | Combines Base64 PNG digit assets in SVG                    |
| Rate Limiting    | Cloudflare Rate Limiting API            | Prevents count inflation (30 requests / 60 seconds per IP) |

The Docker edition uses SQLite for atomic persistent counters and an in-memory SVG cache and rate limiter instead of the corresponding Cloudflare services.

## Notes

- Rate limiting: Up to 30 requests per 60 seconds from the same IP. Returns `429 Too Many Requests` if exceeded.
- The original asset images are included in the repository for reference, but are not used directly at runtime. They are embedded as Base64-encoded strings in `src/assets/`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development and pull request instructions.

## License

Kauntah is distributed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](./LICENSE). The included counter artwork is non-commercial material by Kokage Kusaka; see the license file for details.

## Credits

- **Illustration**: [Kokage Kusaka (日下こかげ)](https://x.com/K_KOKAGE)
  - Originally distributed on ["KK's WS"](https://web.archive.org/web/20090831104303/http://kokagex.hp.infoseek.co.jp/) (now closed)
  - For more details, search for "Nekomimi Counter" and "Kokage Kusaka"
  - Non-commercial use, modification, and redistribution are permitted by the author
