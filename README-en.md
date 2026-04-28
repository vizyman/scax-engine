# scax-engine

Lightweight TypeScript optical simulation engine for ray tracing, Sturm analysis, affine distortion estimation, and induced astigmatism calculation.

## Roadmap

- Accuracy improves as rays become more paraxial.
- This project supports monocular visualization.
- Prism power visualization is planned.
- Add power is not planned due to limitations of the model eye.

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

To reuse a single engine instance in UI flows (sliders, animation), call `update` with a full `props` object and then call `simulate` again instead of creating `new SCAXEngine` on every change. Omitted top-level fields fall back to constructor defaults (fresh apply, not deep merge with previous run).

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
  - `position.z` defaults to vertex distance `12(mm)` when omitted
- `light_source?: LightSourceConfig`
  - Grid: `{ type: "grid", width, height, division, z, vergence }`
  - Radial: `{ type: "radial", radius, division, angle_division, z, vergence }`
  - default is grid source `{ width: 10, height: 10, division: 4, z: -10, vergence: 0 }`
- `pupil_type?: "constricted" | "neutral" | "dilated"` (default: `"neutral"`)

The same `props` options apply to `update()` (see below). If you pass a partial object to `update`, omitted top-level keys are filled with constructor defaults, not previous `update` values. To change one field while keeping others, build and pass a full `props` object each time.

### `engine.update(props?)`

Re-runs the same configuration path as the constructor: rebuilds eye/lens/surfaces/light source from `props` and uses the defaults above for omitted keys. It does not merge with previous in-memory settings.

- `Sturm` and `Affine` instances are **not** recreated; cached Sturm/affine results from before `update` are cleared until those analyses are run again.

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
  - Returns the latest Sturm analysis result

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
  - Returns the latest affine analysis result

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
