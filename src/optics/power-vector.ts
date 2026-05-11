import type { AstigmatismSummaryItem, SCAxPower } from "../scax-engine";
import DegToTABO from "../utils/deg-to-tabo";
import TABOToDeg from "../utils/tabo-to-deg";

export function powerVectorFromCylinder(cylinderD: number, axisDeg: number) {
  const c = Number(cylinderD);
  const ax = ((Number(axisDeg) % 180) + 180) % 180;
  if (!Number.isFinite(c)) return { j0: 0, j45: 0 };
  const rad = (2 * ax * Math.PI) / 180;
  const scale = -c / 2;
  return { j0: scale * Math.cos(rad), j45: scale * Math.sin(rad) };
}

export function aggregatePowerVector(powers: SCAxPower[]) {
  let m = 0;
  let j0 = 0;
  let j45 = 0;
  for (const power of powers) {
    const sphere = Number(power?.s ?? 0);
    const cylinder = Number(power?.c ?? 0);
    const axisTABO = Number(power?.ax ?? 0);
    if (!Number.isFinite(sphere) || !Number.isFinite(cylinder) || !Number.isFinite(axisTABO)) continue;
    const axisDeg = TABOToDeg(axisTABO);
    const rad = (2 * axisDeg * Math.PI) / 180;
    const halfMinusCylinder = -cylinder / 2;
    m += sphere + (cylinder / 2);
    j0 += halfMinusCylinder * Math.cos(rad);
    j45 += halfMinusCylinder * Math.sin(rad);
  }
  return { m, j0, j45 };
}

/** 난시 주경선 TABO 각도: 180deg 동치이므로 표시/비교는 항상 [0, 180)으로 맞춘다. */
export function normalizeTaboMeridian180(value: unknown) {
  const d = Number(value ?? 0);
  if (!Number.isFinite(d)) return 0;
  return ((d % 180) + 180) % 180;
}

export function principalMeridiansFromVector(m: number, j0: number, j45: number): AstigmatismSummaryItem {
  if (!Number.isFinite(m) || !Number.isFinite(j0) || !Number.isFinite(j45)) return [];
  const axisDeg = (((0.5 * Math.atan2(j45, j0) * 180) / Math.PI) % 180 + 180) % 180;
  const taboAxis = normalizeTaboMeridian180(DegToTABO(axisDeg));
  const orthogonalTabo = (taboAxis + 90) % 180;
  const r = Math.hypot(j0, j45);
  const meridians = [
    { tabo: taboAxis, d: m - r },
    { tabo: orthogonalTabo, d: m + r },
  ];
  return meridians.sort((a, b) => a.d - b.d);
}

export function principalMeridiansFromPowers(powers: SCAxPower[]): AstigmatismSummaryItem {
  if (powers.length === 0) return [];
  const { m, j0, j45 } = aggregatePowerVector(powers);
  return principalMeridiansFromVector(m, j0, j45);
}
