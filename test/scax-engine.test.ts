import { describe, expect, it } from "vitest";

import SCAXEngine from "../src/scax-engine";

describe("SCAXEngine", () => {
  describe("simulate 및 rayTracing", () => {
    it("추적된 광선 배열과 info(난시/프리즘) 필드를 반환한다", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.simulate();
      expect(Array.isArray(result.traced_rays)).toBe(true);
      expect(result).toHaveProperty("info");
      expect(result.info).toHaveProperty("astigmatism");
      expect(result.info).toHaveProperty("prism");
      expect(Array.isArray(result.info.astigmatism.eye)).toBe(true);
      expect(Array.isArray(result.info.astigmatism.combined)).toBe(true);
    });

    it("eye/combined 난시 요약에 양주경선 배열이 포함된다", () => {
      const simulator = new SCAXEngine({
        eye: { s: -1, c: -2, ax: 180 },
        lens: [{
          s: 0.5,
          c: -1,
          ax: 180,
          position: { x: 0, y: 0, z: 12 },
          tilt: { x: 0, y: 0 },
        }],
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.simulate();
      expect(result.info.astigmatism.eye.length).toBe(2);
      expect(result.info.astigmatism.combined.length).toBe(2);
      const [weak, strong] = result.info.astigmatism.combined;
      expect(Number.isFinite(weak.d)).toBe(true);
      expect(Number.isFinite(strong.d)).toBe(true);
      expect(weak.d).toBeLessThanOrEqual(strong.d);
      expect(strong.d - weak.d).toBeGreaterThan(0);
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

    it("눈 처방 프리즘과 동일한 렌즈 프리즘이면 net 편위가 0에 가깝다", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 1, p_ax: 180 },
        lens: [{
          s: 2,
          c: 0,
          ax: 0,
          p: 1,
          p_ax: 180,
          position: { x: 0, y: 0, z: 12 },
          tilt: { x: 0, y: 0 },
        }],
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.simulate();
      expect(Math.abs(result.info.prism.combined.p_x)).toBeLessThan(1e-9);
      expect(Math.abs(result.info.prism.combined.p_y)).toBeLessThan(1e-9);
      expect(result.info.prism.combined.magnitude).toBeNull();
    });

    it("eye/lens 모두 교정도수 입력일 때 0도 동일값이면 net 편위가 0에 가깝다", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 2, p_ax: 0 },
        lens: [{
          s: 0,
          c: 0,
          ax: 0,
          p: 2,
          p_ax: 0,
          position: { x: 0, y: 0, z: 12 },
          tilt: { x: 0, y: 0 },
        }],
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.simulate();
      expect(Math.abs(result.info.prism.combined.p_x)).toBeLessThan(1e-9);
      expect(Math.abs(result.info.prism.combined.p_y)).toBeLessThan(1e-9);
      expect(result.info.prism.combined.magnitude).toBeNull();
      expect(Math.abs(result.info.prism.lens.p_y)).toBeLessThan(1e-9);
    });

    it("렌더용 눈 회전량은 내부 ray-tracing 회전과 동일한 부호 규칙을 따른다", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 1, p_ax: 0 },
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const rotation = simulator.getEyeRotation();
      // p=1Δ, base 0° 입력이면 eye 내부 회전(yaw -)과 동일하게 x_deg가 음수다.
      expect(rotation.x_deg).toBeLessThan(0);
      expect(Math.abs(rotation.magnitude_deg)).toBeCloseTo(0.57, 1);
    });

    it("eye tilt 입력은 프리즘 변환 없이 회전에 그대로 반영된다", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0, tilt: { x: 3, y: -2 } },
        light_source: { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      });
      const rotation = simulator.getEyeRotation();
      expect(rotation.x_deg).toBeCloseTo(-2, 8);
      expect(rotation.y_deg).toBeCloseTo(-3, 8);
    });

    it("순수 프리즘 렌즈(S=0,C=0)도 Base 기준 반대방향으로 광선을 편위시킨다", () => {
      const noPrism = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [{ s: 0, c: 0, ax: 0, p: 0, p_ax: 0, position: { x: 0, y: 0, z: 12 }, tilt: { x: 0, y: 0 } }],
        light_source: { type: "radial", radius: 0, division: 4, angle_division: 8, z: -20, vergence: 0 },
      });
      const withPrism = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [{ s: 0, c: 0, ax: 0, p: 4, p_ax: 0, position: { x: 0, y: 0, z: 12 }, tilt: { x: 0, y: 0 } }],
        light_source: { type: "radial", radius: 0, division: 4, angle_division: 8, z: -20, vergence: 0 },
      });
      const noPrismDir = noPrism.rayTracing()[0]?.getDirection();
      const withPrismDir = withPrism.rayTracing()[0]?.getDirection();
      expect(noPrismDir).toBeDefined();
      expect(withPrismDir).toBeDefined();
      expect(Math.abs(withPrismDir!.x)).toBeGreaterThan(Math.abs(noPrismDir!.x) + 1e-6);
      expect(withPrismDir!.x).toBeLessThan(0);
    });

    it("프리즘 축 90도는 렌즈->각막 Base 기준에서 y 양의 방향으로 적용된다", () => {
      const noPrism = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [{ s: 0, c: 0, ax: 0, p: 0, p_ax: 0, position: { x: 0, y: 0, z: 12 }, tilt: { x: 0, y: 0 } }],
        light_source: { type: "radial", radius: 0, division: 4, angle_division: 8, z: -20, vergence: 0 },
      });
      const withPrism90 = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [{ s: 0, c: 0, ax: 0, p: 4, p_ax: 90, position: { x: 0, y: 0, z: 12 }, tilt: { x: 0, y: 0 } }],
        light_source: { type: "radial", radius: 0, division: 4, angle_division: 8, z: -20, vergence: 0 },
      });
      const noPrismDir = noPrism.rayTracing()[0]?.getDirection();
      const withPrismDir = withPrism90.rayTracing()[0]?.getDirection();
      expect(noPrismDir).toBeDefined();
      expect(withPrismDir).toBeDefined();
      expect(Math.abs(withPrismDir!.y)).toBeGreaterThan(Math.abs(noPrismDir!.y) + 1e-6);
      expect(withPrismDir!.y).toBeGreaterThan(0);
    });

    it("eye 프리즘 처방은 광선 추적에도 반영되어 입사광 방향을 바꾼다", () => {
      const base = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [],
        light_source: { type: "radial", radius: 0, division: 4, angle_division: 8, z: -20, vergence: 0 },
      });
      const withEyePrism = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 2, p_ax: 0 },
        lens: [],
        light_source: { type: "radial", radius: 0, division: 4, angle_division: 8, z: -20, vergence: 0 },
      });
      const baseDir = base.rayTracing()[0]?.getDirection();
      const prismDir = withEyePrism.rayTracing()[0]?.getDirection();
      expect(baseDir).toBeDefined();
      expect(prismDir).toBeDefined();
      expect(Math.abs(prismDir!.x)).toBeGreaterThan(Math.abs(baseDir!.x) + 1e-6);
      expect(prismDir!.x).toBeGreaterThan(0);
      const withEyePrismSim = withEyePrism.simulate();
      expect(withEyePrismSim.info.prism.eye.magnitude).toBeCloseTo(2, 8);
      expect(withEyePrism.getEyeRotation().magnitude_deg).toBeGreaterThan(0);
    });

    it("light_source의 position/tilt가 광로와 진행 방향에 반영된다", () => {
      const base = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [],
        light_source: {
          type: "radial",
          radius: 0,
          division: 4,
          angle_division: 8,
          z: -20,
          vergence: 0,
        },
      });
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [],
        light_source: {
          type: "radial",
          radius: 0,
          division: 4,
          angle_division: 8,
          z: -20,
          vergence: 0,
          position: { x: 3, y: -2, z: 1 },
          tilt: { x: 0, y: 10 },
        },
      });

      const baseRay = base.rayTracing()[0];
      const firstRay = simulator.rayTracing()[0];
      const baseState = baseRay as unknown as { points?: Array<{ x: number; y: number; z: number }> };
      const state = firstRay as unknown as { points?: Array<{ x: number; y: number; z: number }> };
      const baseOrigin = baseState.points?.[0];
      const origin = state.points?.[0];
      const baseDirection = baseRay?.getDirection();
      const direction = firstRay?.getDirection();

      expect(baseOrigin).toBeDefined();
      expect(origin).toBeDefined();
      expect(baseDirection).toBeDefined();
      expect(direction).toBeDefined();
      expect(Math.abs(origin!.x - baseOrigin!.x)).toBeGreaterThan(1e-3);
      expect(Math.abs(origin!.y - baseOrigin!.y)).toBeGreaterThan(1e-3);
      expect(direction!.x).toBeGreaterThan(baseDirection!.x + 1e-4);
      expect(direction!.z).toBeLessThan(baseDirection!.z - 1e-4);
    });

    it("off-axis 광원에서도 Sturm 중심점이 안정적으로 계산된다", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
        lens: [],
        light_source: {
          type: "grid",
          width: 8,
          height: 8,
          division: 8,
          z: -20,
          vergence: 0,
          position: { x: 2, y: -1.5, z: 0 },
          tilt: { x: 4, y: 9 },
        },
      });

      const traced = simulator.rayTracing();
      const sturm = simulator.sturmCalculation(traced) as {
        sturm_info?: Array<{
          line: string;
          approx_center?: { x: number; y: number; z: number } | null;
          method?: string;
        }>;
      };
      const dLine = (sturm.sturm_info ?? []).find((item) => item.line === "d");
      expect(traced.length).toBeGreaterThan(0);
      expect(dLine).toBeDefined();
      expect(dLine?.method).toBe("minimum-ellipse");
      expect(dLine?.approx_center).not.toBeNull();
      expect(Number.isFinite(dLine?.approx_center?.x)).toBe(true);
      expect(Number.isFinite(dLine?.approx_center?.y)).toBe(true);
      expect(Number.isFinite(dLine?.approx_center?.z)).toBe(true);
    });

    it("NaN 입력이 포함되어도 회전/시뮬레이션 결과가 유한값으로 유지된다", () => {
      const simulator = new SCAXEngine({
        eye: { s: 0, c: 0, ax: 0, p: 0, p_ax: 0, tilt: { x: Number.NaN, y: Number.NaN } },
        light_source: {
          type: "grid",
          width: 8,
          height: 8,
          division: 4,
          z: -20,
          vergence: 0,
          position: { x: Number.NaN, y: Number.NaN, z: Number.NaN },
          tilt: { x: Number.NaN, y: Number.NaN },
        },
      });
      const rotation = simulator.getEyeRotation();
      const result = simulator.simulate();
      expect(Number.isFinite(rotation.x_deg)).toBe(true);
      expect(Number.isFinite(rotation.y_deg)).toBe(true);
      expect(Number.isFinite(rotation.magnitude_deg)).toBe(true);
      expect(Array.isArray(result.traced_rays)).toBe(true);
    });

    it("dispose 이후 update로 재초기화하면 다시 시뮬레이션 가능하다", () => {
      const simulator = new SCAXEngine({
        light_source: { type: "grid", width: 8, height: 8, division: 4, z: -10, vergence: 0 },
      });
      simulator.simulate();
      simulator.dispose();
      simulator.update({
        eye: { s: -1, c: -0.5, ax: 90 },
        light_source: { type: "grid", width: 8, height: 8, division: 4, z: -10, vergence: 0 },
      });
      const result = simulator.simulate();
      expect(result.traced_rays.length).toBeGreaterThan(0);
    });
  });
});
