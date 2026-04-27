import { describe, expect, it } from "vitest";

import SCAXEngine from "../src/scax-engine";

describe("SCAXEngine", () => {
  describe("calculateInducedAstigmatism", () => {
    it("returns null when all cylinder powers are zero", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0 },
        lens: [],
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: 10, vergence: 0 },
      });
      const result = simulator.calculateInducedAstigmatism({ s: 0, c: 0, ax: 0 }, []);
      expect(result.induced).toBeNull();
      expect(result.eye).toBeNull();
      expect(result.lens).toBeNull();
    });

    it("calculates valid astigmatism from eye cylinder only", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: 10, vergence: 0 },
      });
      const result = simulator.calculateInducedAstigmatism({ s: 0, c: -1.25, ax: 45 }, []);
      expect(result.induced).not.toBeNull();
      expect(result.eye).not.toBeNull();
      expect(result.induced?.d).toBeCloseTo(1.25, 6);
      expect(result.induced?.tabo_deg).toBeGreaterThanOrEqual(0);
      expect(result.induced?.tabo_deg).toBeLessThan(180);
    });

    it("combines eye and multiple lens powers without producing invalid values", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: 10, vergence: 0 },
      });
      const result = simulator.calculateInducedAstigmatism(
        { s: -2, c: -0.75, ax: 90 },
        [
          { s: 0, c: -0.5, ax: 45 },
          { s: 0, c: 0.25, ax: 180 },
        ],
      );
      expect(result.induced).not.toBeNull();
      expect(Number.isFinite(result.induced?.d)).toBe(true);
      expect(Number.isFinite(result.induced?.tabo_deg)).toBe(true);
    });

    it("ignores invalid cylinder inputs safely", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: 10, vergence: 0 },
      });
      const result = simulator.calculateInducedAstigmatism(
        { s: 0, c: Number.NaN, ax: Number.NaN },
        [{ s: 0, c: undefined as unknown as number, ax: 0 }],
      );
      expect(result.induced).toBeNull();
      expect(result.eye).toBeNull();
      expect(result.lens).toBeNull();
    });
  });

  describe("simulate and rayTracing", () => {
    it("returns traced rays array and induced astigmatism field", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: 10, vergence: 0 },
      });
      const result = simulator.simulate();
      expect(Array.isArray(result.traced_rays)).toBe(true);
      expect(result).toHaveProperty("induced_astigmatism");
    });

    it("reduces traced ray count with a smaller pupil diameter", () => {
      const withoutPupilFilter = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 6, z: 10, vergence: 0 },
      });
      const withSmallPupil = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 6, z: 10, vergence: 0 },
        pupilDiameterMm: 0.5,
        pupilPlaneZMm: 0,
      });

      const baseCount = withoutPupilFilter.rayTracing().length;
      const filteredCount = withSmallPupil.rayTracing().length;
      expect(baseCount).toBeGreaterThanOrEqual(0);
      expect(filteredCount).toBeLessThanOrEqual(baseCount);
      if (baseCount > 0) {
        expect(filteredCount).toBeLessThan(baseCount);
      }
    });
  });
});
