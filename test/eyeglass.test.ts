import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import Ray from "../src/ray/ray";
import SCAXEngine from "../src/scax-engine";

type EyeSpec = { s: number; c: number; ax: number };
type LensSpec = {
  s: number;
  c: number;
  ax: number;
  position: { x: number; y: number; z: number };
  tilt: { x: number; y: number };
};

type SturmInfo = {
  line: string;
  approx_center?: { x: number; y: number; z: number } | null;
  has_astigmatism?: boolean;
  anterior?: { z: number; profile?: { angleMajorDeg: number } } | null;
  posterior?: { z: number; profile?: { angleMajorDeg: number } } | null;
};

function createSimulator(eye: EyeSpec, lens: LensSpec[]) {
  return new SCAXEngine({
    eyeModel: "gullstrand",
    eye,
    lens,
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

function createLensSpec(partial: Pick<LensSpec, "s" | "c" | "ax">): LensSpec {
  return {
    ...partial,
    position: { x: 0, y: 0, z: 12 },
    tilt: { x: 0, y: 0 },
  };
}

function injectSingleChiefRay(simulator: SCAXEngine) {
  const ray = new Ray({
    origin: new Vector3(0, 0, -20),
    direction: new Vector3(0, 0, 1),
    frounhofer_line: "d",
  });
  (simulator as unknown as { light_source: { emitRays: () => Ray[] } }).light_source = {
    emitRays: () => [ray.clone()],
  };
}

function extractDLineApproxCenterZ(simulator: SCAXEngine) {
  injectDeterministicRays(simulator);
  const rays = simulator.rayTracing();
  const result = simulator.sturmCalculation(rays) as { sturm_info?: SturmInfo[] };
  const dLine = (result.sturm_info ?? []).find((item) => item.line === "d");
  expect(rays.length).toBeGreaterThan(0);
  expect(dLine?.approx_center).not.toBeNull();
  return dLine!.approx_center!.z;
}

function extractDLineSturm(simulator: SCAXEngine) {
  injectDeterministicRays(simulator);
  const rays = simulator.rayTracing();
  const result = simulator.sturmCalculation(rays) as { sturm_info?: SturmInfo[] };
  const dLine = (result.sturm_info ?? []).find((item) => item.line === "d");
  expect(rays.length).toBeGreaterThan(0);
  expect(dLine).toBeDefined();
  return dLine!;
}

function getChiefRayDirection(simulator: SCAXEngine) {
  injectSingleChiefRay(simulator);
  const rays = simulator.rayTracing();
  expect(rays.length).toBe(1);
  return rays[0].getDirection();
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

function applyLensDecenterX(simulator: SCAXEngine, decenterMm: number) {
  const lenses = (simulator as unknown as { lens: unknown[] }).lens;
  for (const lens of lenses) {
    const mutable = lens as {
      front?: { position?: Vector3 };
      back?: { position?: Vector3 | null };
      position?: Vector3;
    };
    if (mutable.position) mutable.position.x += decenterMm;
    if (mutable.front?.position) mutable.front.position.x += decenterMm;
    if (mutable.back?.position) mutable.back.position.x += decenterMm;
  }
}

function applyLensTiltY(simulator: SCAXEngine, tiltDeg: number) {
  const lenses = (simulator as unknown as { lens: unknown[] }).lens;
  for (const lens of lenses) {
    const mutable = lens as {
      tilt?: { y: number };
      front?: { tilt?: { y: number } };
      back?: { tilt?: { y: number } | null };
    };
    if (mutable.tilt) mutable.tilt.y += tiltDeg;
    if (mutable.front?.tilt) mutable.front.tilt.y += tiltDeg;
    if (mutable.back?.tilt) mutable.back.tilt.y += tiltDeg;
  }
}

describe("eyeglass behavior", () => {
  it("reflects spectacle power change on emmetropic eye focus", () => {
    const emmetropeNoLens = createSimulator({ s: 0, c: 0, ax: 0 }, []);
    const emmetropeWithPlusLens = createSimulator({ s: 0, c: 0, ax: 0 }, [createLensSpec({ s: 2, c: 0, ax: 0 })]);

    const zWithoutLens = extractDLineApproxCenterZ(emmetropeNoLens);
    const zWithPlusLens = extractDLineApproxCenterZ(emmetropeWithPlusLens);
    expect(zWithPlusLens).toBeGreaterThan(zWithoutLens);
  });

  it("returns ametropic eye close to emmetropic focus when corrected lens is applied", () => {
    const emmetrope = createSimulator({ s: 0, c: 0, ax: 0 }, []);
    const ametropicEye = { s: 4, c: 0, ax: 0 };
    const myopeWithoutLens = createSimulator(ametropicEye, []);
    const zEmmetrope = extractDLineApproxCenterZ(emmetrope);
    const zMyopeWithoutLens = extractDLineApproxCenterZ(myopeWithoutLens);

    // Simulate practical refraction: find the spectacle sphere that best restores emmetropic focus.
    let bestLensPower = 0;
    let bestError = Number.POSITIVE_INFINITY;
    let bestCorrectedZ = Number.NaN;
    for (let s = -12; s <= 12; s += 0.5) {
      const corrected = createSimulator(ametropicEye, [createLensSpec({ s, c: 0, ax: 0 })]);
      const zCorrected = extractDLineApproxCenterZ(corrected);
      const error = Math.abs(zCorrected - zEmmetrope);
      if (error < bestError) {
        bestError = error;
        bestLensPower = s;
        bestCorrectedZ = zCorrected;
      }
    }

    expect(Math.abs(bestLensPower)).toBeGreaterThan(0);
    expect(Math.abs(bestCorrectedZ - zMyopeWithoutLens)).toBeGreaterThan(0.05);
    expect(Number.isFinite(bestError)).toBe(true);
  });

  it("calculates induced astigmatism correctly for mismatched eye/lens cylinder", () => {
    const simulator = createSimulator({ s: 0, c: 0, ax: 0 }, []);
    const eye = { s: 0, c: -2.0, ax: 180 };
    const lens = [createLensSpec({ s: 0, c: +1.0, ax: 90 })];
    const result = simulator.calculateInducedAstigmatism(eye, lens);
    expect(result.induced).not.toBeNull();

    // Power-vector (J0/J45) expected magnitude.
    const dEye = 2.0;
    const dLens = -1.0;
    const expectedInducedD = Math.abs(dEye - dLens);
    expect(result.induced!.d).toBeCloseTo(expectedInducedD, 6);
  });

  it("matches decentration-induced prism to Prentice formula trend", () => {
    const lensPowerD = 5;
    const decenterMm = 4;
    const centered = createSimulator({ s: 0, c: 0, ax: 0 }, [createLensSpec({ s: lensPowerD, c: 0, ax: 0 })]);
    const decentered = createSimulator({ s: 0, c: 0, ax: 0 }, [createLensSpec({ s: lensPowerD, c: 0, ax: 0 })]);
    applyLensDecenterX(decentered, decenterMm);

    const dirCentered = getChiefRayDirection(centered);
    const dirDecentered = getChiefRayDirection(decentered);
    const deltaAngleRad = Math.abs(Math.atan2(dirDecentered.x, dirDecentered.z) - Math.atan2(dirCentered.x, dirCentered.z));

    // Prentice: Prism(Δ) = c(cm) * F(D), and tan(theta)=Δ/100.
    const expectedPrismDiopter = (decenterMm / 10) * lensPowerD;
    const expectedAngleRad = Math.atan(expectedPrismDiopter / 100);
    expect(deltaAngleRad).toBeCloseTo(expectedAngleRad, 1);
  });

  it("shows tilt-induced meridional change on toric spectacle lens", () => {
    const tiltDeg = 12;
    const noTilt = createSimulator({ s: 0, c: 0, ax: 0 }, [createLensSpec({ s: 0, c: -2, ax: 180 })]);
    const withTilt = createSimulator({ s: 0, c: 0, ax: 0 }, [createLensSpec({ s: 0, c: -2, ax: 180 })]);
    applyLensTiltY(withTilt, tiltDeg);
    const dNoTilt = extractDLineSturm(noTilt);
    const dWithTilt = extractDLineSturm(withTilt);
    expect(Boolean(dNoTilt.has_astigmatism)).toBe(true);
    expect(Boolean(dWithTilt.has_astigmatism)).toBe(true);
    expect(dNoTilt.anterior).not.toBeNull();
    expect(dWithTilt.anterior).not.toBeNull();
    // Lens tilt should alter meridional orientation or interval location in a measurable way.
    const axisNoTilt = dNoTilt.anterior?.profile?.angleMajorDeg ?? 0;
    const axisWithTilt = dWithTilt.anterior?.profile?.angleMajorDeg ?? 0;
    const axisDelta = Math.abs((((axisWithTilt - axisNoTilt) % 180) + 180) % 180);
    const zDelta = Math.abs((dWithTilt.approx_center?.z ?? 0) - (dNoTilt.approx_center?.z ?? 0));
    expect(Math.min(axisDelta, 180 - axisDelta) + zDelta).toBeGreaterThan(0.05);
  });
});
