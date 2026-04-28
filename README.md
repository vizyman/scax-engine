# scax-engine

Lightweight TypeScript optical simulation engine for ray tracing, Sturm analysis, affine distortion estimation, and induced astigmatism calculation.

`README.md` placed at the repository root is shown on the GitHub repository main page by default.

## Install

```bash
npm install scax-engine
```

## Quick Start

```ts
import { SCAXEngine } from "scax-engine";

const engine = new SCAXEngine({
  eyeModel: "gullstrand",
  eye: { s: -2.0, c: -0.75, ax: 90 },
  lens: [
    {
      s: 0,
      c: -0.5,
      ax: 180,
      position: { x: 0, y: 0, z: 12 },
      tilt: { x: 0, y: 0 },
    },
  ],
  light_source: { type: "grid", width: 10, height: 10, division: 6, z: -10, vergence: 0 },
  pupil_type: "neutral",
});

const result: ReturnType<SCAXEngine["simulate"]> = engine.simulate();
console.log(result.traced_rays.length);
console.log(result.induced_astigmatism);
```

To reuse one engine in a UI (sliders, animation) instead of `new SCAXEngine` on every change, call `update` with a full `props` object, then `simulate` again. Omitted top-level fields fall back to the same defaults as the constructor (this is a fresh apply, not a deep merge with the previous run).

```ts
const engine = new SCAXEngine({ /* initial props */ });

engine.update({
  eyeModel: "gullstrand",
  eye: { s: -2.5, c: -0.75, ax: 90 },
  lens: [],
  light_source: { type: "grid", width: 10, height: 10, division: 6, z: -10, vergence: 0 },
  pupil_type: "neutral",
});

const next = engine.simulate();
```

## API

### `new SCAXEngine(props?)`

Creates a simulation engine instance. Internal `Sturm` and `Affine` helpers are created once per instance.

#### `props`

- `eyeModel?: "gullstrand" | "navarro"` (default: `"gullstrand"`)
- `eye?: { s: number; c: number; ax: number }` (default: `{ s: 0, c: 0, ax: 0 }`)
- `lens?: LensConfig[]` (default: `[]`)
  - `LensConfig = { s, c, ax, position: { x, y, z }, tilt: { x, y } }`
  - `position.z` default is vertex distance `12(mm)` when omitted
- `light_source?: LightSourceConfig`
  - Grid: `{ type: "grid", width, height, division, z, vergence }`
  - Radial: `{ type: "radial", radius, division, angle_division, z, vergence }`
  - default is grid source `{ width: 10, height: 10, division: 4, z: -10, vergence: 0 }`
- `pupil_type?: "constricted" | "neutral" | "dilated"` (default: `"neutral"`)

The same `props` options apply to `update()` (see below). When you only pass a partial object to `update`, any omitted top-level key is filled with the constructor default—not with the value from the previous `update` call. To change one thing while keeping others, build a full `props` object in your app state and pass that each time.

### `engine.update(props?)`

Re-runs the same configuration path as the constructor: rebuilds eye/lens/surfaces/light source from `props` using the default values above for any omitted key. Does not merge with the previous in-memory settings.

- `Sturm` and `Affine` instances are **not** recreated; any cached Sturm/affine results from before the update are cleared until you run those analyses again.

#### `props`

Same shape and defaults as **`new SCAXEngine(props?)`** above.

### Instance Methods

- `update(props?)` — reconfigure the engine; see **`engine.update(props?)`** above.

- `simulate()`
  ```ts
  (): {
    traced_rays: Ray[];
    induced_astigmatism: {
      induced: { d: number; tabo_deg: number } | null;
      eye: { d: number; tabo_deg: number } | null;
      lens: { d: number; tabo_deg: number } | null;
    };
  }
  ```
  - Runs ray tracing and induced astigmatism calculation

- `getSturmGapAnalysis()`
  ```ts
  (): {
    slices_info: {
      count: number;
      slices: Array<{
        z: number;
        ratio: number;
        size: number;
        profile: {
          at: { x: number; y: number; z: number };
          wMajor: number;
          wMinor: number;
          angleMajorDeg: number;
          angleMinorDeg: number;
        };
      }>;
    };
    sturm_info: Array<{
      line: "g" | "F" | "e" | "d" | "C" | "r";
      wavelength_nm: number;
      color: number | null;
      has_astigmatism: boolean;
      method: "sturm-interval-midpoint" | "minimum-ellipse";
      anterior: {
        z: number;
        ratio: number;
        size: number;
        profile: {
          at: { x: number; y: number; z: number };
          wMajor: number;
          wMinor: number;
          angleMajorDeg: number;
          angleMinorDeg: number;
        };
      } | null;
      posterior: {
        z: number;
        ratio: number;
        size: number;
        profile: {
          at: { x: number; y: number; z: number };
          wMajor: number;
          wMinor: number;
          angleMajorDeg: number;
          angleMinorDeg: number;
        };
      } | null;
      approx_center: { x: number; y: number; z: number; mode: "top2-mid" | "min-size" | "top1-flat" } | null;
    }>;
  } | null
  ```
  - Returns latest Sturm analysis result

- `getAffineAnalysis()`
  ```ts
  (): {
    a: number; b: number; c: number; d: number; e: number; f: number;
    count: number;
    residualAvgPct: number;
    residualMaxPct: number;
    residuals: Array<{
      sx: number; sy: number; px: number; py: number; rx: number; ry: number; magnitude: number; pct: number;
    }>;
  } | null
  ```
  - Returns latest affine analysis result


## UMD Usage

UMD build is generated at `dist/scax-engine.umd.js` and exposed as `ScaxEngine`.

## Development

```bash
npm install
npm run build
npm test
```

### Scripts

- `npm run clean` - remove `dist`
- `npm run build` - build ESM/CJS/UMD bundles and type declarations
- `npm test` - run Vitest once
- `npm run test:watch` - run Vitest in watch mode

## Publish

```bash
npm run build
npm test
npm publish --access public
```
