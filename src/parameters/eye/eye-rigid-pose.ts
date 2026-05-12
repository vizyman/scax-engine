import { Euler, Quaternion, Vector3 } from "three";
import Surface from "../../surfaces/surface";

/** 각막 기준 안구 회전점 z(mm). `SCAXEngineCore`와 동일. */
export const EYE_ROTATION_PIVOT_FROM_CORNEA_MM = 13;

function normalizePrismAmount(value: unknown) {
  const p = Number(value ?? 0);
  return Number.isFinite(p) ? Math.max(0, p) : 0;
}

function normalizeAngle360(value: unknown) {
  const d = Number(value ?? 0);
  if (!Number.isFinite(d)) return 0;
  return ((d % 360) + 360) % 360;
}

function prismVectorFromBase(prismDiopter: number, baseAngleDeg: number) {
  const p = normalizePrismAmount(prismDiopter);
  const baseAngle = normalizeAngle360(baseAngleDeg);
  const deviationAngle = normalizeAngle360(baseAngle + 180);
  const rad = (-deviationAngle * Math.PI) / 180;
  return {
    x: p * Math.cos(rad),
    y: p * Math.sin(rad),
  };
}

function prismComponentToAngleDeg(componentPrism: number) {
  const c = Number(componentPrism);
  if (!Number.isFinite(c)) return 0;
  return (Math.atan(c / 100) * 180) / Math.PI;
}

/** eye 처방(Base) → 실제 안구 편향에 쓰는 역벡터(내부 x/y, Δ). */
export function eyePrismEffectVectorFromPrescription(p: unknown, p_ax: unknown) {
  const eyeRx = prismVectorFromBase(normalizePrismAmount(p), normalizeAngle360(p_ax));
  return { x: -eyeRx.x, y: -eyeRx.y };
}

/**
 * eye.p / eye.p_ax(임상 Base) 및 eye.tilt(°)로부터
 * 안구 강체 회전 쿼터니언(Euler XYZ, z=0). 기존 configure 광선 피벗 회전과 동일.
 */
export function eyePrismAndTiltToQuaternion(
  p: unknown,
  p_ax: unknown,
  tiltDeg: { x: number; y: number },
): Quaternion {
  const { x, y } = eyePrismEffectVectorFromPrescription(p, p_ax);
  const eyeRotXDeg = prismComponentToAngleDeg(x);
  const eyeRotYDeg = prismComponentToAngleDeg(y);
  const eyeEulerXDeg = eyeRotYDeg + tiltDeg.x;
  const eyeEulerYDeg = (-eyeRotXDeg) + tiltDeg.y;
  return new Quaternion().setFromEuler(new Euler(
    (eyeEulerXDeg * Math.PI) / 180,
    (eyeEulerYDeg * Math.PI) / 180,
    0,
    "XYZ",
  ));
}

export function eyeRotationPivot(): Vector3 {
  return new Vector3(0, 0, EYE_ROTATION_PIVOT_FROM_CORNEA_MM);
}

/** eye prism/tilt를 반영한 렌더용 각도(°). */
export function eyeRotationForRenderDegrees(
  p: unknown,
  p_ax: unknown,
  tiltDeg: { x: number; y: number },
) {
  const { x, y } = eyePrismEffectVectorFromPrescription(p, p_ax);
  const eyeRotXDeg = prismComponentToAngleDeg(x);
  const eyeRotYDeg = prismComponentToAngleDeg(y);
  const eyeEulerXDeg = eyeRotYDeg + tiltDeg.x;
  const eyeEulerYDeg = (-eyeRotXDeg) + tiltDeg.y;
  const xDeg = eyeEulerYDeg;
  const yDeg = -eyeEulerXDeg;
  return {
    x_deg: xDeg,
    y_deg: yDeg,
    magnitude_deg: Math.hypot(xDeg, yDeg),
  };
}

/**
 * 안구 회전점 기준 강체 회전을 각 표면의 world `position` / `tilt`에 반영합니다.
 */
export function applyRigidEyePoseToSurfaces(
  surfaces: Surface[],
  pivot: Vector3,
  rotation: Quaternion,
): void {
  for (const surface of surfaces) {
    surface.applyRigidRotationAboutPivot(pivot, rotation);
  }
}
