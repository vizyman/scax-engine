import { describe, expect, it } from "vitest";

import { GullstrandParameter } from "../src/parameters/eye/gullstrand-parameter";
import { NavarroParameter } from "../src/parameters/eye/navarro-parameter";
import SCAXEngine from "../src/scax-engine";

type EyeModel = "gullstrand" | "navarro";

type EyeSpec = {
  s: number;
  c: number;
  ax: number;
};

type LensSpec = {
  s: number;
  c: number;
  ax: number;
  position: { x: number; y: number; z: number };
  tilt: { x: number; y: number };
};

type SturmInfo = {
  line: string;
  approx_center?: { z: number } | null;
};

const MODEL_CASES: Array<{ model: EyeModel; retinaZ: number }> = [
  {
    model: "gullstrand",
    retinaZ: GullstrandParameter.parameter.surfaces.find((surface) => surface.name === "retina")?.z ?? 24,
  },
  {
    model: "navarro",
    retinaZ: NavarroParameter.parameter.surfaces.find((surface) => surface.name === "retina")?.z ?? 24.04,
  },
];

function createLensSpec(partial: Pick<LensSpec, "s" | "c" | "ax">): LensSpec {
  return {
    ...partial,
    position: { x: 0, y: 0, z: 12 },
    tilt: { x: 0, y: 0 },
  };
}

function createEngine(model: EyeModel, eye: EyeSpec, lens: LensSpec[] = []) {
  return new SCAXEngine({
    eyeModel: model,
    eye,
    lens,
    light_source: {
      type: "grid",
      width: 8,
      height: 8,
      division: 10,
      z: -20,
      vergence: 0,
    },
  });
}

function extractDLineCenterZ(engine: SCAXEngine) {
  const rays = engine.rayTracing();
  expect(rays.length).toBeGreaterThan(0);
  const sturm = engine.sturmCalculation(rays) as { sturm_info?: SturmInfo[] };
  const dLine = (sturm.sturm_info ?? []).find((item) => item.line === "d");
  expect(dLine?.approx_center).not.toBeNull();
  return dLine!.approx_center!.z;
}

function createSeededRandom(seed: number) {
  let current = seed >>> 0;
  return () => {
    current = (1664525 * current + 1013904223) >>> 0;
    return current / 0x1_0000_0000;
  };
}

function randomBetween(next: () => number, min: number, max: number) {
  return min + (max - min) * next();
}

describe("시뮬레이션 품질 검증 세트", () => {
  it("정시안 기준에서 d-line 초점 중심이 망막 근방에 형성된다", () => {
    for (const { model, retinaZ } of MODEL_CASES) {
      const centerZ = extractDLineCenterZ(createEngine(model, { s: 0, c: 0, ax: 0 }));
      expect(centerZ).toBeCloseTo(retinaZ, 0);
    }
  });

  it("비영(0이 아닌) 구면 렌즈는 무렌즈 대비 초점 위치를 변화시킨다", () => {
    for (const { model } of MODEL_CASES) {
      const eye = { s: 0, c: 0, ax: 0 };
      const baseZ = extractDLineCenterZ(createEngine(model, eye));
      const plus4Z = extractDLineCenterZ(createEngine(model, eye, [createLensSpec({ s: 4, c: 0, ax: 0 })]));
      const minus4Z = extractDLineCenterZ(createEngine(model, eye, [createLensSpec({ s: -4, c: 0, ax: 0 })]));

      expect(Math.abs(plus4Z - baseZ)).toBeGreaterThan(0.05);
      expect(Math.abs(minus4Z - baseZ)).toBeGreaterThan(0.05);
    }
  });

  it("난시 축 180도 주기성(axis, axis+180)에서 simulate 난시 요약이 동일하다", () => {
    const base = createEngine("gullstrand", { s: 0, c: -1.75, ax: 25 }).simulate();
    const wrapped = createEngine("gullstrand", { s: 0, c: -1.75, ax: 205 }).simulate();
    expect(base.info.astigmatism.combined[0]).toEqual(wrapped.info.astigmatism.combined[0]);
  });

  it("동일 입력 반복 실행 시 광선 수와 초점 위치가 안정적으로 재현된다", () => {
    const engine = createEngine("navarro", { s: 1.5, c: -0.75, ax: 80 }, [createLensSpec({ s: -1.25, c: 0, ax: 0 })]);
    const firstRays = engine.rayTracing().length;
    const firstCenterZ = extractDLineCenterZ(engine);

    for (let i = 0; i < 5; i += 1) {
      const rays = engine.rayTracing().length;
      const centerZ = extractDLineCenterZ(engine);
      expect(rays).toBe(firstRays);
      expect(centerZ).toBeCloseTo(firstCenterZ, 8);
    }
  });

  it("넓은 입력 범위에서도 수치가 유한값으로 유지된다", () => {
    const next = createSeededRandom(20260428);
    for (let i = 0; i < 30; i += 1) {
      const eye: EyeSpec = {
        s: randomBetween(next, -8, 8),
        c: randomBetween(next, -4, 0),
        ax: randomBetween(next, 0, 180),
      };
      const lens: LensSpec[] = [
        createLensSpec({
          s: randomBetween(next, -8, 8),
          c: randomBetween(next, -2, 2),
          ax: randomBetween(next, 0, 180),
        }),
      ];
      const model: EyeModel = next() > 0.5 ? "gullstrand" : "navarro";
      const engine = createEngine(model, eye, lens);
      const centerZ = extractDLineCenterZ(engine);
      expect(Number.isFinite(centerZ)).toBe(true);
      const combinedMeridians = engine.simulate().info.astigmatism.combined[0] ?? [];
      expect(Array.isArray(combinedMeridians)).toBe(true);
      expect(combinedMeridians.length).toBe(2);
      expect(Number.isFinite(combinedMeridians[0]?.d)).toBe(true);
      expect(Number.isFinite(combinedMeridians[1]?.d)).toBe(true);
    }
  });
});
