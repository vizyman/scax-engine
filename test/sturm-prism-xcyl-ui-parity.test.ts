import { describe, expect, it } from "vitest";
import SCAXEngine from "../src/scax-engine";

/** test/ui-test/ui-test.html — SPECTACLE_VD_Z_MM */
const SPECTACLE_VD_Z_MM = -18;

describe("Sturm UI parity: prism spectacle + cross cyl (negative z VD)", () => {
  it("p=3 p_ax=0 + JCC at TABO 0/90/180 yields posterior for d-line", () => {
    const prismLens = {
      s: 0,
      c: 0,
      ax: 0,
      p: 3,
      p_ax: 0,
      position: { x: 0, y: 0, z: SPECTACLE_VD_Z_MM },
      tilt: { x: 0, y: 0 },
    };
    const crossCylBase = {
      s: 0.25,
      c: -0.5,
      p: 0,
      p_ax: 0,
      position: { x: 0, y: 0, z: SPECTACLE_VD_Z_MM + 2 },
      tilt: { x: 0, y: 0 },
    };

    for (const axTABO of [0, 90, 180] as const) {
      const engine = new SCAXEngine({
        eyeModel: "gullstrand",
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        // Same push order as ui-test buildLensConfigs (sorted by z: prism first, then xcyl)
        lens: [prismLens, { ...crossCylBase, ax: axTABO }],
        light_source: {
          type: "grid",
          width: 0.5,
          height: 0.5,
          division: 5,
          z: -50,
          vergence: 0,
          position: { x: 0, y: 0, z: 0 },
          tilt: { x: 0, y: 0 },
        },
      });
      const traced = engine.rayTracing();
      const sturm = engine.sturmCalculation(traced) as {
        sturm_info?: Array<{
          line: string;
          has_astigmatism?: boolean;
          anterior?: { profile?: { at?: { z: number } } } | null;
          posterior?: { profile?: { at?: { z: number } } } | null;
        }>;
      };
      const dLine = sturm.sturm_info?.find((e) => e.line === "d");
      expect(dLine?.posterior, `posterior TABO ${axTABO}`).toBeTruthy();
      const az = dLine?.anterior?.profile?.at?.z;
      const pz = dLine?.posterior?.profile?.at?.z;
      expect(az, `anterior z TABO ${axTABO}`).toBeGreaterThanOrEqual(0);
      expect(az, `anterior z TABO ${axTABO}`).toBeLessThanOrEqual(28);
      expect(pz, `posterior z TABO ${axTABO}`).toBeGreaterThanOrEqual(0);
      expect(pz, `posterior z TABO ${axTABO}`).toBeLessThanOrEqual(28);
    }
  });
});
