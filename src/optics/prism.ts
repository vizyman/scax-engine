import type { PrismSummaryItem, PrismVector } from "../scax-engine";

export function normalizePrismAmount(value: unknown) {
  const p = Number(value ?? 0);
  return Number.isFinite(p) ? Math.max(0, p) : 0;
}

export function normalizeAngle360(value: unknown) {
  const d = Number(value ?? 0);
  if (!Number.isFinite(d)) return 0;
  return ((d % 360) + 360) % 360;
}

export function prismVectorFromBase(prismDiopter: number, baseAngleDeg: number) {
  const p = normalizePrismAmount(prismDiopter);
  const baseAngle = normalizeAngle360(baseAngleDeg);
  // Clinical Base convention:
  // - input axis is prism base direction, viewed from lens side toward cornea (OD: right=0deg)
  // - light deviation is opposite to base, so internally convert by +180deg
  const deviationAngle = normalizeAngle360(baseAngle + 180);
  // Internal x/y uses math-style +x right, +y up.
  // Because user axis is defined from lens->cornea view, flip angular direction by negating theta.
  const rad = (-deviationAngle * Math.PI) / 180;
  return {
    x: p * Math.cos(rad),
    y: p * Math.sin(rad),
  };
}

export function vectorToPrismInfo(x: number, y: number): PrismVector {
  const xx = Number.isFinite(x) ? x : 0;
  const yy = Number.isFinite(y) ? y : 0;
  const magnitude = Math.hypot(xx, yy);
  const angleDeg = normalizeAngle360((Math.atan2(yy, xx) * 180) / Math.PI);
  return {
    x: xx,
    y: yy,
    magnitude,
    angle_deg: magnitude < 1e-12 ? 0 : angleDeg,
  };
}

export function toPrismSummaryItem(value: PrismVector): PrismSummaryItem {
  const magnitude = Number(value?.magnitude);
  return {
    p_x: Number(value?.x ?? 0),
    p_y: Number(value?.y ?? 0),
    prism_angle: normalizeAngle360(value?.angle_deg),
    magnitude: Number.isFinite(magnitude) && magnitude >= 1e-9 ? magnitude : null,
  };
}

export function prismComponentToAngleDeg(componentPrism: number) {
  const c = Number(componentPrism);
  if (!Number.isFinite(c)) return 0;
  return (Math.atan(c / 100) * 180) / Math.PI;
}

export function prismMagnitudeToAngleDeg(prismDiopter: number) {
  const p = Number(prismDiopter);
  if (!Number.isFinite(p) || p < 1e-12) return 0;
  return (Math.atan(p / 100) * 180) / Math.PI;
}
