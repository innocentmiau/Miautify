# Miautify

[![CI](https://github.com/innocentmiau/Miautify/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/innocentmiau/Miautify/actions/workflows/ci.yml)

A music player for Linux and Windows that points at a folder of mp3 files and
plays it. No server, no import step, and it never renames your files.

Right now it's an empty window: the player is being built feature by feature.

## Run from source

Needs [Node.js](https://nodejs.org/) 22.12 or newer.

```sh
npm install
npm start
```

Other scripts:

- `npm run typecheck`: check the TypeScript types.
- `npm run check`: lint and check formatting with [Biome](https://biomejs.dev/).
- `npm run format`: fix formatting.

## License

[MIT](LICENSE)
