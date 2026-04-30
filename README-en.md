# scax-engine

TypeScript optical simulation library for a model eye (Gullstrand / Navarro): ray tracing, Sturm interval analysis, affine distortion estimation, and induced astigmatism / prism deviation. Ships ESM, CJS, and UMD builds.

Korean documentation: [README.md](README.md)

## Requirements

- **Node.js** 20 or later (local development and tests)
- Runtime dependency: **three** (declared by this package)

## Roadmap

- Accuracy improves as rays become more paraxial.
- This project supports monocular visualization.
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

const result = engine.simulate();
console.log(result.traced_rays.length);
console.log(result.induced_astigmatism);
console.log(result.light_deviation);
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
  - If `position.z` is omitted, the default spectacle **vertex distance 12 mm** is used.
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
- For `light_deviation`, the eye prism contribution uses the opposite vector to represent actual ocular deviation.
- The lens is a physical refracting element, so ray tracing uses the prescribed deviation direction as given.
- When correction matches, lens and eye prism agree in magnitude and axis and `net_prism` is near zero.

### `engine.update(props?)`

Re-runs the same configuration path as the constructor: rebuilds eye, lens, surfaces, and light source from `props`.

- `Sturm` and `Affine` instances are not recreated, but cached Sturm / affine results are cleared until you run `simulate` (or equivalent) again.

### Instance methods

- `update(props?)` — same as above.

- `simulate()`
  ```ts
  (): {
    traced_rays: Ray[];
    induced_astigmatism: {
      induced: { d: number; tabo_deg: number } | null;
      eye: { d: number; tabo_deg: number } | null;
      lens: { d: number; tabo_deg: number } | null;
    };
    light_deviation: {
      eye_prism_effect: PrismVector;
      lens_prism_total: PrismVector;
      net_prism: PrismVector;
      x_angle_deg: number;
      y_angle_deg: number;
      net_angle_deg: number;
    };
  }
  ```
  - Ray tracing, induced astigmatism summary, and prism / angle deviation.

- `getEyeRotationForRender()`
  ```ts
  (): {
    x_deg: number;
    y_deg: number;
    magnitude_deg: number;
    source_prism: { p: number; p_ax: number };
    source_tilt: { x: number; y: number };
  }
  ```
  - Eye rotation for rendering from prescribed prism plus `eye.tilt`.

- `rayTracing()` — runs ray tracing only and returns traced `Ray[]`. `simulate()` runs tracing plus Sturm, induced astigmatism, and deviation.

- `sturmCalculation(rays?)` — computes Sturm slices and per–Fraunhofer-line summaries for the given rays (defaults to the last `rayTracing` / `simulate` output). `simulate()` already refreshes Sturm internally.

- `getAffineAnalysis()` — builds retina correspondence pairs for the current setup, fits an affine map (or returns cache). May be `null` when there are not enough valid pairs.

- `estimateAffineDistortion(pairs)` / `affine2d(pairs)` — fit a 2D affine from your own `AffinePair[]`. `affine2d` is a compatibility alias.

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
