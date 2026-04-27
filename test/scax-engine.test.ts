import { describe, expect, it } from "vitest";

import SCAXEngine from "../src/scax-engine";

describe("SCAXEngine", () => {
  describe("calculateInducedAstigmatism", () => {
    it("모든 원주 도수가 0이면 null을 반환한다", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0 },
        lens: [],
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.calculateInducedAstigmatism({ s: 0, c: 0, ax: 0 }, []);
      expect(result.induced).toBeNull();
      expect(result.eye).toBeNull();
      expect(result.lens).toBeNull();
    });

    it("눈의 원주 도수만으로 유효한 난시를 계산한다", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.calculateInducedAstigmatism({ s: 0, c: -1.25, ax: 45 }, []);
      expect(result.induced).not.toBeNull();
      expect(result.eye).not.toBeNull();
      expect(result.induced?.d).toBeCloseTo(1.25, 6);
      expect(result.induced?.tabo_deg).toBeGreaterThanOrEqual(0);
      expect(result.induced?.tabo_deg).toBeLessThan(180);
    });

    it("눈과 여러 렌즈 도수를 합성해도 비정상 값이 발생하지 않는다", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
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

    it("유효하지 않은 원주 도수 입력을 안전하게 무시한다", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
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

  describe("simulate 및 rayTracing", () => {
    it("추적된 광선 배열과 유발 난시 필드를 반환한다", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.simulate();
      expect(Array.isArray(result.traced_rays)).toBe(true);
      expect(result).toHaveProperty("induced_astigmatism");
    });

    it("동공이 축동되면 추적 광선 수가 증가하지 않는다", () => {
      const withoutPupilFilter = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 6, z: -10, vergence: 0 },
        pupil_type: "neutral",
      });
      const withSmallPupil = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 6, z: -10, vergence: 0 },
        pupil_type: "constricted",
      });

      const baseCount = withoutPupilFilter.rayTracing().length;
      const filteredCount = withSmallPupil.rayTracing().length;
      expect(baseCount).toBeGreaterThanOrEqual(0);
      expect(filteredCount).toBeLessThanOrEqual(baseCount);
    });
  });
});
