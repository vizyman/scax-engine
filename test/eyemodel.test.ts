import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import SCAXEngine from "../src/scax-engine";
import { GullstrandParameter } from "../src/parameters/eye/gullstrand-parameter";
import { NavarroParameter } from "../src/parameters/eye/navarro-parameter";
import Ray from "../src/ray/ray";
import TABOToDeg from "../src/utils/tabo-to-deg";

type EyeModel = "gullstrand" | "navarro";

function createSimulator(eyeModel: EyeModel, eye: { s: number; c: number; ax: number }) {
  return new SCAXEngine({
    eyeModel,
    eye,
    lens: [],
    light_source: {
      type: "grid",
      width: 6,
      height: 6,
      division: 8,
      z: 0,
      vergence: 0,
    },
  });
}

function injectDeterministicRays(simulator: SCAXEngine) {
  const rays: Ray[] = [];
  const points = [-1, -0.5, 0, 0.5, 1];
  for (const y of points) {
    for (const x of points) {
      rays.push(new Ray({
        origin: new Vector3(x, y, -20),
        direction: new Vector3(0, 0, 1),
        frounhofer_line: "d",
      }));
    }
  }
  (simulator as unknown as { light_source: { emitRays: () => Ray[] } }).light_source = {
    emitRays: () => rays.map((ray) => ray.clone()),
  };
}

function extractDLineSturmInfo(simulator: SCAXEngine) {
  injectDeterministicRays(simulator);
  const rays = simulator.rayTracing();
  const result = simulator.sturmCalculation(rays) as {
    sturm_info?: Array<{
      line: string;
      approx_center?: { z: number } | null;
      has_astigmatism?: boolean;
      anterior?: { z: number; profile: { angleMajorDeg: number } } | null;
      posterior?: { z: number; profile: { angleMajorDeg: number } } | null;
    }>;
  };
  const dInfo = (result.sturm_info ?? []).find((entry) => entry.line === "d");
  expect(rays.length).toBeGreaterThan(0);
  expect(dInfo).toBeDefined();
  expect(dInfo?.approx_center).not.toBeNull();
  return dInfo!;
}

function angleDiff180(a: number, b: number) {
  const raw = Math.abs((((a - b) % 180) + 180) % 180);
  return Math.min(raw, 180 - raw);
}

describe("눈 모델 Sturm 동작", () => {
  it("각 모델의 정시안에서 approx_center가 망막 위치와 일치한다", () => {
    const modelCases = [
      { model: "gullstrand" as const, retinaZ: GullstrandParameter.parameter.surfaces.find((s) => s.name === "retina")?.z ?? 24 },
      { model: "navarro" as const, retinaZ: NavarroParameter.parameter.surfaces.find((s) => s.name === "retina")?.z ?? 24.04 },
    ];

    for (const { model, retinaZ } of modelCases) {
      const simulator = createSimulator(model, { s: 0, c: 0, ax: 0 });
      const dInfo = extractDLineSturmInfo(simulator);
      expect(dInfo.approx_center?.z).toBeCloseTo(retinaZ, 0);
    }
  });

  it("S 값이 감소하면 approx_center가 전방으로 이동한다", () => {
    const modelCases: EyeModel[] = ["gullstrand", "navarro"];
    for (const model of modelCases) {
      const minus = extractDLineSturmInfo(createSimulator(model, { s: -6, c: 0, ax: 0 })).approx_center!.z;
      const emmetrope = extractDLineSturmInfo(createSimulator(model, { s: 0, c: 0, ax: 0 })).approx_center!.z;
      expect(minus).toBeLessThan(emmetrope);
    }
  });

  it("S 값이 증가하면 approx_center가 후방으로 이동한다", () => {
    const modelCases: EyeModel[] = ["gullstrand", "navarro"];
    for (const model of modelCases) {
      const emmetrope = extractDLineSturmInfo(createSimulator(model, { s: 0, c: 0, ax: 0 })).approx_center!.z;
      const plus = extractDLineSturmInfo(createSimulator(model, { s: 6, c: 0, ax: 0 })).approx_center!.z;
      expect(plus).toBeGreaterThan(emmetrope);
    }
  });

  it("난시를 적용하면 유효한 Sturm 구간과 자오선 관계를 형성한다", () => {
    const axisTABO = 180;
    const expectedDegAxis = TABOToDeg(axisTABO);
    const modelCases: EyeModel[] = ["gullstrand", "navarro"];

    for (const model of modelCases) {
      const dInfo = extractDLineSturmInfo(createSimulator(model, { s: 0, c: -2.0, ax: axisTABO }));

      expect(dInfo.has_astigmatism).toBe(true);
      expect(dInfo.anterior).not.toBeNull();
      expect(dInfo.posterior).not.toBeNull();

      const anterior = dInfo.anterior!;
      const posterior = dInfo.posterior!;
      expect(anterior.z).toBeLessThanOrEqual(posterior.z);

      const axisGap = angleDiff180(anterior.profile.angleMajorDeg, posterior.profile.angleMajorDeg);
      expect(axisGap).toBeGreaterThan(45);

      const alignAnterior = angleDiff180(anterior.profile.angleMajorDeg, expectedDegAxis);
      const alignPosterior = angleDiff180(posterior.profile.angleMajorDeg, expectedDegAxis);
      expect(Math.min(alignAnterior, alignPosterior)).toBeLessThan(35);
    }
  });
});
