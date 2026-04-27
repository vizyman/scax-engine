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

const result = engine.simulate();
console.log(result.traced_rays.length);
console.log(result.induced_astigmatism);
```

## API

### `new SCAXEngine(props?)`

Creates a simulation engine instance.

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

### Instance Methods

- `simulate()`
  - Runs ray tracing and induced astigmatism calculation
  - Return type: `{
      traced_rays: Ray[];
      induced_astigmatism: {
        induced: { d: number; tabo_deg: number } | null;
        eye: { d: number; tabo_deg: number } | null;
        lens: { d: number; tabo_deg: number } | null;
      };
    }`

- `getSturmGapAnalysis()`
  - Returns latest Sturm analysis result
  - Return type: `{
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
    } | null`

- `getAffineAnalysis()`
  - Returns latest affine analysis result
  - Return type: `{
      a: number; b: number; c: number; d: number; e: number; f: number;
      count: number;
      residualAvgPct: number;
      residualMaxPct: number;
      residuals: Array<{
        sx: number; sy: number; px: number; py: number; rx: number; ry: number; magnitude: number; pct: number;
      }>;
    } | null`


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
