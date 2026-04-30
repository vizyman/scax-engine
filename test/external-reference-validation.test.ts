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

type ReferenceCase = {
  id: string;
  source: string;
  eyeModel: EyeModel;
  eye: EyePowerInput;
  lens?: LensConfig[];
  expected: {
    d_line_center_z_mm?: number;
  };
  tolerance: {
    d_line_center_z_mm?: number;
  };
};

type ReferenceDataset = {
  metadata: {
    title: string;
    description: string;
  };
  cases: ReferenceCase[];
};

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
      if (Number.isFinite(testCase.expected.d_line_center_z_mm)) {
        const actualCenterZ = extractDLineCenterZ(engine);
        expect(actualCenterZ).not.toBeNull();
        const zTolerance = Number(testCase.tolerance.d_line_center_z_mm ?? 0.25);
        expect(Math.abs((actualCenterZ as number) - Number(testCase.expected.d_line_center_z_mm))).toBeLessThanOrEqual(zTolerance);
      }
    });
  }
});
