import { describe, expect, it } from "vitest";

import SCAXEngine from "../src/scax-engine";
import datasetJson from "./fixtures/external-reference-data.json";

type EyeModel = "gullstrand" | "navarro";

type EyePowerInput = {
  s: number;
  c: number;
  ax: number;
};

type LensConfig = {
  s: number;
  c: number;
  ax: number;
  position?: { x?: number; y?: number; z?: number };
  tilt?: { x?: number; y?: number };
};

type InducedAstigmatismExpected = {
  d: number;
  tabo_deg: number;
};

type ReferenceCase = {
  id: string;
  source: string;
  eyeModel: EyeModel;
  eye: EyePowerInput;
  lens?: LensConfig[];
  expected: {
    d_line_center_z_mm?: number;
    induced_astigmatism?: InducedAstigmatismExpected;
    induced_astigmatism_null?: boolean;
  };
  tolerance: {
    d_line_center_z_mm?: number;
    induced_d?: number;
    induced_axis_deg?: number;
  };
};

type ReferenceDataset = {
  metadata: {
    title: string;
    description: string;
  };
  cases: ReferenceCase[];
};

function normalizeAxisDiffDeg(a: number, b: number) {
  const diff = Math.abs((((a - b) % 180) + 180) % 180);
  return Math.min(diff, 180 - diff);
}

function extractDLineCenterZ(engine: SCAXEngine) {
  const rays = engine.rayTracing();
  const sturm = engine.sturmCalculation(rays) as {
    sturm_info?: Array<{ line: string; approx_center?: { z: number } | null }>;
  };
  const dLine = (sturm.sturm_info ?? []).find((item) => item.line === "d");
  if (!dLine?.approx_center) return null;
  return dLine.approx_center.z;
}

function createEngine(testCase: ReferenceCase) {
  const lens = (testCase.lens ?? []).map((item) => ({
    s: Number(item.s),
    c: Number(item.c),
    ax: Number(item.ax),
    position: {
      x: Number(item.position?.x ?? 0),
      y: Number(item.position?.y ?? 0),
      z: Number(item.position?.z ?? 12),
    },
    tilt: {
      x: Number(item.tilt?.x ?? 0),
      y: Number(item.tilt?.y ?? 0),
    },
  }));

  return new SCAXEngine({
    eyeModel: testCase.eyeModel,
    eye: testCase.eye,
    lens,
    light_source: { type: "grid", width: 8, height: 8, division: 10, z: -20, vergence: 0 },
  });
}

describe("External reference validation", () => {
  // Replace this dataset with measured/simulator-exported ground truth values.
  const dataset = datasetJson as ReferenceDataset;
  const cases = Array.isArray(dataset.cases) ? dataset.cases : [];

  it("reference dataset has at least one case", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const testCase of cases) {
    it(`matches reference: ${testCase.id}`, () => {
      const engine = createEngine(testCase);
      const lensPowers = (testCase.lens ?? []).map((lens) => ({
        s: Number(lens.s),
        c: Number(lens.c),
        ax: Number(lens.ax),
      }));

      if (Number.isFinite(testCase.expected.d_line_center_z_mm)) {
        const actualCenterZ = extractDLineCenterZ(engine);
        expect(actualCenterZ).not.toBeNull();
        const zTolerance = Number(testCase.tolerance.d_line_center_z_mm ?? 0.25);
        expect(Math.abs((actualCenterZ as number) - Number(testCase.expected.d_line_center_z_mm))).toBeLessThanOrEqual(zTolerance);
      }

      if (testCase.expected.induced_astigmatism_null === true) {
        const actual = engine.calculateInducedAstigmatism(testCase.eye, lensPowers).induced;
        expect(actual).toBeNull();
      } else if (testCase.expected.induced_astigmatism) {
        const expected = testCase.expected.induced_astigmatism;
        const actual = engine.calculateInducedAstigmatism(testCase.eye, lensPowers).induced;
        expect(actual).not.toBeNull();
        const dTolerance = Number(testCase.tolerance.induced_d ?? 0.1);
        const axisTolerance = Number(testCase.tolerance.induced_axis_deg ?? 2);
        expect(Math.abs((actual as { d: number }).d - expected.d)).toBeLessThanOrEqual(dTolerance);
        expect(normalizeAxisDiffDeg((actual as { tabo_deg: number }).tabo_deg, expected.tabo_deg)).toBeLessThanOrEqual(axisTolerance);
      }
    });
  }
});
