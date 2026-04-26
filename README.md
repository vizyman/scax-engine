# scax-engine

TypeScript calculation utility library that can be published to npm and bundled as ESM, CJS, and UMD.

## Install

```bash
npm install scax-engine
```

## Usage

```ts
import { add, divide, percentage } from "scax-engine";

const total = add({ left: 20, right: 22 }); // 42
const ratio = divide({ left: 10, right: 2 }); // 5
const percent = percentage({ left: 25, right: 200 }); // 12.5
```

UMD build is generated at `dist/index.umd.js` and exposed as `ScaxEngine`.

## Scripts

- `npm run build`: Builds ESM/CJS/UMD bundles and TypeScript declarations.
- `npm test`: Runs Vitest unit tests.

## Publish

```bash
npm run build
npm test
npm publish --access public
```
