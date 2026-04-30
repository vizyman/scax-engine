# scax-engine

TypeScript ophthalmic-optics simulation library for a model eye (Gullstrand / Navarro, monocular OD baseline): ray tracing, Sturm interval analysis, affine distortion estimation, and induced astigmatism / prism deviation. Ships ESM, CJS, and UMD builds.

Korean documentation: [README.md](README.md)

## Requirements

- **Node.js** 20 or later (local development and tests)
- Runtime dependency: **three** (declared by this package)

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
console.log(result.info.astigmatism.combined);
console.log(result.info.prism.combined);
```

To reuse one engine instance in UI flows (sliders, animation), call `update` with a **full** `props` object, then `simulate` again instead of `new SCAXEngine` on every change. Omitted top-level keys are **not** deep-merged with the previous run; they fall back to constructor defaults.

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
- `eye?: { s, c, ax, p?, p_ax?, tilt? }` (default: `{ s: 0, c: 0, ax: 0, p: 0, p_ax: 0 }`)
  - `tilt?: { x?: number; y?: number }` — degrees; folded into render rotation / eye pose.
- `lens?: LensConfig[]` (default: `[]`)
  - `LensConfig = { s, c, ax, p?, p_ax?, position: { x, y, z }, tilt: { x, y } }`
  - If `position.z` is omitted, the default spectacle vertex distance (**VD**) of **12 mm** is used.
- `light_source?: LightSourceConfig`
  - Grid: `{ type: "grid", width, height, division, z, vergence, position?, tilt? }`
  - Chromatic grid: `{ type: "grid_rg", ... }` — for each grid point, emits Fraunhofer **e**- and **C**-line rays (`division` must be greater than 4).
  - Radial: `{ type: "radial", radius, division, angle_division, z, vergence, position?, tilt? }`
  - Optional `position` and `tilt` (degrees) offset / orient the source.
  - Default: `{ type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 }`
- `pupil_type?: "constricted" | "neutral" | "dilated" | "none"` (default: `"neutral"`)
  - `"none"` disables entrance-pupil clipping.

The same `props` rules apply to `update()`. If you pass a partial object, omitted top-level keys are always filled from **defaults**, not from the previous `update`. Build a full `props` object in your app when you change a single field.

#### Prism input convention

- `eye.p` / `eye.p_ax` are **prescription (correction) amounts**.
- `lens.p` / `lens.p_ax` are **prescription (correction) amounts**.
- `p_ax` is the clinical **base** direction, in the **lens-facing-the-cornea** frame.
- In `simulate().info.prism.eye`, the eye prism contribution uses the opposite vector to represent actual ocular deviation.
- The lens is a physical refracting element, so ray tracing uses the prescribed deviation direction as given.
- When correction matches, lens and eye prism agree in magnitude and axis and `net_prism` is near zero.

### `engine.update(props?)`

Re-runs the same configuration path as the constructor: rebuilds eye, lens, surfaces, and light source from `props`.

- `Sturm` and `Affine` instances are not recreated, but cached Sturm / affine results are cleared until you run `simulate` (or equivalent) again.

### `engine.dispose()`

Releases per-instance tracing/analysis caches and per-surface trace history.

- Clears traced rays, cached Sturm/affine results, and surface incident/refracted history.
- In UI flows that create engines frequently (e.g., continuous slider updates), call `dispose()` on stale instances to keep memory usage stable.

### Instance methods

- `update(props?)` — same as above.
- `dispose()` — clears internal caches and surface trace history.

- `simulate()`
  ```ts
  (): {
    traced_rays: Ray[];
    info: {
      astigmatism: {
        eye: { tabo_deg: number; d: number | null };
        lens: Array<{ name: string; type: string; tabo_deg: number; d: number | null }>;
        combined: { tabo_deg: number; d: number | null };
      };
      prism: {
        eye: { p_x: number; p_y: number; prism_angle: number; magnitude: number | null };
        lens: { p_x: number; p_y: number; prism_angle: number; magnitude: number | null };
        combined: { p_x: number; p_y: number; prism_angle: number; magnitude: number | null };
      };
    };
  }
  ```
  - Returns ray tracing output plus astigmatism/prism summaries.
  - `d` and `magnitude` are returned as `null` when they are effectively zero.

- `getEyeRotation()`
  ```ts
  (): {
    x_deg: number;
    y_deg: number;
    magnitude_deg: number;
  }
  ```
  - Eye rotation for rendering from prescribed prism plus `eye.tilt`.

- `rayTracing()` — runs ray tracing only and returns traced `Ray[]`. `simulate()` runs tracing plus Sturm and astigmatism/prism summaries.

- `sturmCalculation(rays?)` — computes Sturm slices and per–Fraunhofer-line summaries for the given rays (defaults to the last `rayTracing` / `simulate` output). `simulate()` already refreshes Sturm internally.

- `getAffineAnalysis()` — builds retina correspondence pairs for the current setup, fits an affine map (or returns cache). May be `null` when there are not enough valid pairs.

- `estimateAffineDistortion(pairs)` — fit a 2D affine from your own `AffinePair[]`.

- `calculateInducedAstigmatism(eye, lens)` — induced astigmatism summary for supplied powers (also used inside `simulate`).

## UMD

The UMD bundle is written to `dist/scax-engine.umd.js` and exposes the global **`ScaxEngine`**.

## Development

```bash
npm install
npm run build
npm test
```

### Scripts

- `npm run clean` — remove `dist`
- `npm run build` — type declarations and ESM / CJS / UMD bundles
- `npm test` — run Vitest once
- `npm run test:watch` — Vitest watch mode

For a manual browser playground, open `test/ui-test/ui-test.html` (you may need to point script tags at your built output).

## Publish

```bash
npm run build
npm test
npm publish --access public
```

## License

MIT
