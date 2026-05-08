import { describe, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";

import SCAXEngine from "../src/scax-engine";
import { PUPIL_SIZE } from "../src/parameters/constants";

type EvalState = {
  eyeS: number;
  lensS: number;
  vergence: number;
  lightPosX: number;
  lightTiltY: number;
  pupilType: "constricted" | "neutral" | "dilated" | "none";
};

function getRayPoints(ray: unknown): Vector3[] {
  const r = ray as { points?: Vector3[]; _points?: Vector3[] };
  if (Array.isArray(r?.points)) return r.points;
  if (Array.isArray(r?._points)) return r._points;
  return [];
}

function getSurfaceQuaternion(surface: unknown) {
  const s = surface as { tilt?: { x?: number; y?: number } };
  const tiltXDeg = Number(s?.tilt?.x || 0);
  const tiltYDeg = Number(s?.tilt?.y || 0);
  return new Quaternion().setFromEuler(
    new Euler(
      (tiltXDeg * Math.PI) / 180,
      (tiltYDeg * Math.PI) / 180,
      0,
      "XYZ",
    ),
  );
}

function observerPupilHitCentroidX(engine: SCAXEngine, pupilType: EvalState["pupilType"]) {
  const reflectedRays = engine.traceReflectedRays();
  const pupilStop = (engine.surfaces || []).find((surface) => (
    String((surface as { name?: string })?.name || "").toLowerCase() === "pupil_stop"
  ));
  if (!pupilStop) return { x: Number.NaN, hits: 0, reflected: reflectedRays.length };

  const pos = (pupilStop as { position?: { x?: number; y?: number; z?: number } }).position || { x: 0, y: 0, z: 0 };
  const planePoint = new Vector3(Number(pos.x) || 0, Number(pos.y) || 0, Number(pos.z) || 0);
  const q = getSurfaceQuaternion(pupilStop);
  const qInv = q.clone().invert();
  const planeNormal = new Vector3(0, 0, 1).applyQuaternion(q).normalize();
  const pupilRadiusFromSurface = Number((pupilStop as { radius?: number }).radius);
  const pupilRadiusFromState = Number(PUPIL_SIZE[pupilType]) / 2;
  const pupilRadius = Number.isFinite(pupilRadiusFromSurface) && pupilRadiusFromSurface > 0
    ? pupilRadiusFromSurface
    : pupilRadiusFromState;
  if (!Number.isFinite(pupilRadius) || pupilRadius <= 0) return { x: Number.NaN, hits: 0, reflected: reflectedRays.length };

  const hits: Array<{ x: number; y: number }> = [];
  for (const ray of reflectedRays) {
    const r = ray as { endPoint?: () => Vector3; getDirection?: () => Vector3 };
    const origin = r?.endPoint?.();
    const dir = r?.getDirection?.();
    if (!origin || !dir) continue;
    const denom = dir.dot(planeNormal);
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) continue;
    const t = planePoint.clone().sub(origin).dot(planeNormal) / denom;
    if (!Number.isFinite(t) || t <= 0) continue;
    const hit = origin.clone().addScaledVector(dir, t);
    const local = hit.clone().sub(planePoint).applyQuaternion(qInv);
    if ((local.x * local.x + local.y * local.y) > (pupilRadius * pupilRadius)) continue;
    hits.push({ x: local.x, y: local.y });
  }
  if (!hits.length) return { x: Number.NaN, hits: 0, reflected: reflectedRays.length };
  const sx = hits.reduce((acc, p) => acc + p.x, 0);
  return { x: sx / hits.length, hits: hits.length, reflected: reflectedRays.length };
}

function makeEngine(state: EvalState) {
  return new SCAXEngine({
    eyeModel: "navarro",
    pupil_type: state.pupilType,
    eye: {
      s: state.eyeS,
      c: 0,
      ax: 180,
      p: 0,
      p_ax: 0,
      tilt: { x: 0, y: 0 },
    },
    lens: [{
      s: state.lensS,
      c: 0,
      ax: 180,
      p: 0,
      p_ax: 0,
      position: { x: 0, y: 0, z: 12 },
      tilt: { x: 0, y: 0 },
    }],
    light_source: {
      type: "grid",
      width: 0.5,
      height: 0.5,
      division: 5,
      z: -50,
      vergence: state.vergence,
      position: { x: state.lightPosX, y: 0, z: 0 },
      tilt: { x: 0, y: state.lightTiltY },
    },
  });
}

function toViewerX(x: number) {
  return -x;
}

function motionDxByPosition(state: EvalState, deltaPosX = 0.5) {
  const left = makeEngine({ ...state, lightPosX: state.lightPosX - deltaPosX, lightTiltY: state.lightTiltY });
  const right = makeEngine({ ...state, lightPosX: state.lightPosX + deltaPosX, lightTiltY: state.lightTiltY });
  try {
    left.simulate();
    right.simulate();
    const cLeft = observerPupilHitCentroidX(left, state.pupilType);
    const cRight = observerPupilHitCentroidX(right, state.pupilType);
    const dx = toViewerX(cRight.x - cLeft.x);
    return {
      dx,
      hitsMin: Math.min(cLeft.hits, cRight.hits),
      reflectedMin: Math.min(cLeft.reflected, cRight.reflected),
    };
  } finally {
    left.dispose();
    right.dispose();
  }
}

function motionDxByTilt(state: EvalState, deltaTiltY = 0.5) {
  const left = makeEngine({ ...state, lightPosX: state.lightPosX, lightTiltY: state.lightTiltY - deltaTiltY });
  const right = makeEngine({ ...state, lightPosX: state.lightPosX, lightTiltY: state.lightTiltY + deltaTiltY });
  try {
    left.simulate();
    right.simulate();
    const cLeft = observerPupilHitCentroidX(left, state.pupilType);
    const cRight = observerPupilHitCentroidX(right, state.pupilType);
    const dx = toViewerX(cRight.x - cLeft.x);
    return {
      dx,
      hitsMin: Math.min(cLeft.hits, cRight.hits),
      reflectedMin: Math.min(cLeft.reflected, cRight.reflected),
    };
  } finally {
    left.dispose();
    right.dispose();
  }
}

describe("retinoscopy motion diagnostic", () => {
  it("reports motion sign across lens powers", () => {
    const scenarios = [
      { name: "eyeS=-4", eyeS: -4 },
      { name: "eyeS=+4", eyeS: 4 },
    ];
    const lensSweep = [-10, -6, -3, 0, 3];
    const report = scenarios.map((scenario) => {
      const base: EvalState = {
        eyeS: scenario.eyeS,
        lensS: 0,
        vergence: -2,
        lightPosX: 0,
        lightTiltY: 0,
        pupilType: "dilated",
      };
      const table = lensSweep.map((lensS) => {
        const state = { ...base, lensS };
        const byPos = motionDxByPosition(state);
        const byTilt = motionDxByTilt(state);
        return {
          lensS,
          posDx: byPos.dx,
          posHitsMin: byPos.hitsMin,
          posReflectedMin: byPos.reflectedMin,
          tiltDx: byTilt.dx,
          tiltHitsMin: byTilt.hitsMin,
          tiltReflectedMin: byTilt.reflectedMin,
        };
      });
      return { scenario: scenario.name, table };
    });
    // Diagnostic output for user-side judgement.
    // eslint-disable-next-line no-console
    console.log(`\n[retinoscopy motion diagnostic]\n${JSON.stringify(report, null, 2)}`);

    expect(report.length).toBe(scenarios.length);
  });
});

