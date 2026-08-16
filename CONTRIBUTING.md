# Contributing

Thank you for contributing to Kauntah.

## Development setup

Kauntah requires Node.js 24.16 or later.

```sh
npm ci
npm test
npm run typecheck
```

Run the self-hosted server locally with a writable data directory:

```sh
DATA_DIR=./data npm run dev:selfhost
```

Alternatively, build and run the Docker edition:

```sh
cp .env.example .env
docker compose up -d --build
```

## Pull requests

- Keep changes focused and include tests for behavior changes.
- Run the tests and type checker before opening a pull request.
- Update both `README.md` and `README.ja.md` when user-facing behavior changes.
- Do not commit credentials, `.env` files, local databases, or generated build output.

By contributing, you agree that your contribution is distributed under the repository's [license](./LICENSE), including its non-commercial and share-alike terms.

