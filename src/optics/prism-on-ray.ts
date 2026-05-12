import { Vector3 } from "three";
import { RAY_SURFACE_ESCAPE_MM } from "../parameters/constants";
import Ray from "../ray/ray";

export function normalizePrismDiopters(value: unknown): number {
  const p = Number(value ?? 0);
  return Number.isFinite(p) ? Math.max(0, p) : 0;
}

export function normalizeAngle360Degrees(value: unknown): number {
  const d = Number(value ?? 0);
  if (!Number.isFinite(d)) return 0;
  return ((d % 360) + 360) % 360;
}

/**
 * 임상 프리즘 Base(Δ, 렌즈→각막 시점 °)를 내부 x/y 프리즘 벡터(Δ)로 변환합니다.
 * `SCAXEngineCore`와 동일한 관례입니다.
 */
export function prismVectorFromClinicalBase(
  prismDiopter: unknown,
  baseAngleDeg: unknown,
): { x: number; y: number } {
  const p = normalizePrismDiopters(prismDiopter);
  const baseAngle = normalizeAngle360Degrees(baseAngleDeg);
  const deviationAngle = normalizeAngle360Degrees(baseAngle + 180);
  const rad = (-deviationAngle * Math.PI) / 180;
  return {
    x: p * Math.cos(rad),
    y: p * Math.sin(rad),
  };
}

/**
 * 굴절 직후 광선에 프리즘 편향(소각 근사)을 적용합니다.
 */
export function applyPrismVectorToRay(ray: Ray, prism: { x: number; y: number }): Ray {
  const px = Number(prism?.x ?? 0);
  const py = Number(prism?.y ?? 0);
  if (
    !Number.isFinite(px)
    || !Number.isFinite(py)
    || (Math.abs(px) < 1e-12 && Math.abs(py) < 1e-12)
  ) {
    return ray;
  }
  const direction = ray.getDirection();
  const dz = Number(direction.z);
  if (!Number.isFinite(dz) || Math.abs(dz) < 1e-12) return ray;
  const tx = (direction.x / dz) + (px / 100);
  const ty = (direction.y / dz) + (py / 100);
  const signZ = dz >= 0 ? 1 : -1;
  const newDirection = new Vector3(tx * signZ, ty * signZ, signZ).normalize();
  if (!Number.isFinite(newDirection.x) || !Number.isFinite(newDirection.y) || !Number.isFinite(newDirection.z)) {
    return ray;
  }
  const updated = ray.clone();
  const origin = updated.endPoint();
  updated.continueFrom(
    origin.clone().addScaledVector(newDirection, RAY_SURFACE_ESCAPE_MM),
    newDirection,
  );
  return updated;
}
