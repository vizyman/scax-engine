import { Quaternion, Vector3 } from "three";
import { LightSource } from "../light-sources/light-source";
import { RAY_SURFACE_ESCAPE_MM } from "../parameters/constants";
import Ray from "../ray/ray";
import Surface from "../surfaces/surface";

export type RayTraceOptions = {
  lensSurfaces: Surface[];
  eyeSurfaces: Surface[];
  lightSource: LightSource;
  hasPupilStop: boolean;
  pupilDiameterMm: number | null;
  lensPrismVector: { x: number; y: number };
  eyeRotationQuaternion: Quaternion;
  eyeRotationQuaternionInverse: Quaternion;
  eyeRotationPivot: Vector3;
  lightSourcePosition: Vector3;
  lightSourceRotationQuaternion: Quaternion;
  lightSourceRotationPivot: Vector3;
};

export type RayTraceResult = {
  tracedRays: Ray[];
  sourceRaysForSturm: Ray[];
};

export function traceRaysThroughOpticalSystem(options: RayTraceOptions): RayTraceResult {
  const {
    lensSurfaces,
    eyeSurfaces,
    lightSource,
    hasPupilStop,
    pupilDiameterMm,
    lensPrismVector,
    eyeRotationQuaternion,
    eyeRotationQuaternionInverse,
    eyeRotationPivot,
    lightSourcePosition,
    lightSourceRotationQuaternion,
    lightSourceRotationPivot,
  } = options;

  lensSurfaces.forEach((surface) => surface.clearTraceHistory());
  eyeSurfaces.forEach((surface) => surface.clearTraceHistory());
  const emittedSourceRays = lightSource.emitRays().map((ray) => applyLightSourceTransformToRay(
    ray,
    lightSourceRotationQuaternion,
    lightSourceRotationPivot,
    lightSourcePosition,
  ));
  const sourceRays = hasPupilStop
    ? emittedSourceRays
    : emittedSourceRays.filter((ray) => isRayInsidePupil(ray, pupilDiameterMm));
  const sourceRaysForSturm = sourceRays.map((ray) => ray.clone());
  const tracedRays: Ray[] = [];

  for (const sourceRay of sourceRays) {
    let activeRay = sourceRay.clone();
    let valid = true;
    for (const surface of lensSurfaces) {
      const nextRay = surface.refract(activeRay);
      if (!(nextRay instanceof Ray)) {
        valid = false;
        break;
      }
      activeRay = nextRay;
    }
    if (!valid) {
      if (activeRay.getPointCount() >= 2) tracedRays.push(activeRay);
      continue;
    }
    activeRay = applyPrismVectorToRay(activeRay, lensPrismVector);
    activeRay = transformRayAroundPivot(activeRay, eyeRotationQuaternionInverse, eyeRotationPivot);
    for (const surface of eyeSurfaces) {
      const nextRay = surface.refract(activeRay);
      if (!(nextRay instanceof Ray)) {
        valid = false;
        break;
      }
      activeRay = nextRay;
    }
    activeRay = transformRayAroundPivot(activeRay, eyeRotationQuaternion, eyeRotationPivot);

    if (valid) {
      tracedRays.push(activeRay);
    } else if (activeRay.getPointCount() >= 2) {
      // 일부 면에서 실패하더라도 실패 지점까지의 실제 광로는 시각화에 남깁니다.
      tracedRays.push(activeRay);
    }
  }

  return { tracedRays, sourceRaysForSturm };
}

function isRayInsidePupil(ray: Ray, pupilDiameterMm: number | null) {
  const diameter = pupilDiameterMm;
  if (!Number.isFinite(diameter) || (diameter as number) <= 0) return true;
  const radius = (diameter as number) / 2;
  const origin = ray.getPointReference(0);
  if (!origin) return false;
  return Math.hypot(origin.x, origin.y) <= radius + 1e-6;
}

function applyPrismVectorToRay(ray: Ray, prism: { x: number; y: number }) {
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

function rotatePointAroundPivot(point: Vector3, rotation: Quaternion, pivot: Vector3) {
  return point.clone().sub(pivot).applyQuaternion(rotation).add(pivot);
}

function translateRay(ray: Ray, offset: Vector3) {
  if (offset.lengthSq() < 1e-12) return ray;
  if (ray.getPointCount() === 0) return ray;
  return ray.withTransformedPath(
    (point) => point.add(offset),
    (direction) => direction,
  );
}

function transformRayAroundPivot(ray: Ray, rotation: Quaternion, pivot: Vector3) {
  if (ray.getPointCount() === 0) return ray;
  return ray.withTransformedPath(
    (point) => rotatePointAroundPivot(point, rotation, pivot),
    (direction) => direction.applyQuaternion(rotation),
  );
}

function applyLightSourceTransformToRay(
  ray: Ray,
  rotation: Quaternion,
  pivot: Vector3,
  position: Vector3,
) {
  const rotated = transformRayAroundPivot(ray, rotation, pivot);
  return translateRay(rotated, position);
}
