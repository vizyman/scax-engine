import { RefractiveIndexSpec } from "../../optics/refractive-index";
import ApertureStopSurface from "../../surfaces/aperture-stop-surface";
import AsphericalSurface from "../../surfaces/aspherical-surface";
import SphericalImageSurface from "../../surfaces/spherical-image";
import SphericalSurface from "../../surfaces/spherical-surface";
import STSurface from "../../surfaces/st-surface";
import Surface from "../../surfaces/surface";
import {
  EYE_ST_SURFACE_OFFSET_MM,
  FRAUNHOFER_REFRACTIVE_INDICES,
  RAY_SURFACE_ESCAPE_MM,
} from "../constants";
import {
  applyRigidEyePoseToSurfaces,
  eyePrismAndTiltToQuaternion,
  eyeRotationPivot,
} from "./eye-rigid-pose";

interface BaseEyeSurfaceParameter {
  name: string;
  z: number;
}

interface SphericalEyeSurfaceParameter extends BaseEyeSurfaceParameter {
  type: "spherical";
  radius: number;
  n_before: RefractiveIndexSpec;
  n_after: RefractiveIndexSpec;
}

interface AsphericalEyeSurfaceParameter extends BaseEyeSurfaceParameter {
  type: "aspherical";
  radius: number;
  conic: number;
  n_before: RefractiveIndexSpec;
  n_after: RefractiveIndexSpec;
}

interface SphericalImageEyeSurfaceParameter extends BaseEyeSurfaceParameter {
  type: "spherical-image";
  radius: number;
}

type EyeSurfaceParameter =
  | SphericalEyeSurfaceParameter
  | AsphericalEyeSurfaceParameter
  | SphericalImageEyeSurfaceParameter;

export interface EyeModelParameterConfig {
  unit: string;
  axis: string;
  origin?: string;
  surfaces: EyeSurfaceParameter[];
}

/**
 * `SCAXEngineCore.configure`와 동일한 눈 처방 필드.
 * - `s,c,ax`: auto refractor(굴절오차) 기준; ST 면에는 보정렌즈 관점으로 변환되어 들어갑니다.
 * - `p,p_ax,tilt`: 안구 회전점 기준 강체 pose로 각 표면 `position`/`tilt`에 전개됩니다.
 */
export type EyeStackCreateInput = {
  eyeModel: "gullstrand" | "navarro";
  s: number;
  c: number;
  ax: number;
  p?: number;
  p_ax?: number;
  tilt?: { x?: number; y?: number };
  /** 0이면 동공 aperture 면을 넣지 않습니다. */
  pupilDiameterMm: number;
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePrismAmount(value: unknown) {
  const p = Number(value ?? 0);
  return Number.isFinite(p) ? Math.max(0, p) : 0;
}

function normalizeAngle360(value: unknown) {
  const d = Number(value ?? 0);
  if (!Number.isFinite(d)) return 0;
  return ((d % 360) + 360) % 360;
}

export class EyeModelParameter {
  constructor(private readonly parameter: EyeModelParameterConfig) { }

  /**
   * 동공(선택) → eye_st(ST 복합면) → 안구 모델 해부면 순으로 생성한 뒤,
   * `p`/`p_ax`/`tilt`를 안구 회전점 기준 강체 회전으로 반영합니다.
   */
  createSurface(eye: EyeStackCreateInput): Surface[] {
    const normalizedEyeSphere = toFiniteNumber(eye.s) + (eye.eyeModel === "gullstrand" ? -1 : 0);
    const eyePower = {
      s: -normalizedEyeSphere,
      c: -toFiniteNumber(eye.c),
      ax: toFiniteNumber(eye.ax),
    };
    const pNorm = normalizePrismAmount(eye.p);
    const pAxNorm = normalizeAngle360(eye.p_ax);
    const tiltDeg = {
      x: toFiniteNumber(eye.tilt?.x),
      y: toFiniteNumber(eye.tilt?.y),
    };
    const rotation = eyePrismAndTiltToQuaternion(pNorm, pAxNorm, tiltDeg);

    const eyeSt = new STSurface({
      type: "compound",
      name: "eye_st",
      position: { x: 0, y: 0, z: -EYE_ST_SURFACE_OFFSET_MM },
      referencePoint: { x: 0, y: 0, z: 0 },
      tilt: { x: 0, y: 0 },
      s: eyePower.s,
      c: eyePower.c,
      ax: eyePower.ax,
      n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
      n: FRAUNHOFER_REFRACTIVE_INDICES.cornea,
      n_after: FRAUNHOFER_REFRACTIVE_INDICES.aqueous,
    });

    const anatomical = this.parameter.surfaces.map((surface) => {
      if (surface.type === "spherical") {
        return new SphericalSurface({
          type: "spherical",
          name: surface.name,
          r: surface.radius,
          position: { x: 0, y: 0, z: surface.z },
          tilt: { x: 0, y: 0 },
          n_before: surface.n_before,
          n_after: surface.n_after,
        });
      }

      if (surface.type === "aspherical") {
        return new AsphericalSurface({
          type: "aspherical",
          name: surface.name,
          position: { x: 0, y: 0, z: surface.z },
          tilt: { x: 0, y: 0 },
          r: surface.radius,
          conic: surface.conic,
          n_before: surface.n_before,
          n_after: surface.n_after,
        });
      }

      if (surface.type === "spherical-image") {
        return new SphericalImageSurface({
          type: "spherical-image",
          name: surface.name,
          r: surface.radius,
          position: { x: 0, y: 0, z: surface.z },
          tilt: { x: 0, y: 0 },
          retina_extra_after: true,
        });
      }

      throw new Error(`Unsupported surface type: ${(surface as { type: string }).type}`);
    });

    const surfaces: Surface[] = [eyeSt, ...anatomical];
    const pupilMm = toFiniteNumber(eye.pupilDiameterMm);
    if (Number.isFinite(pupilMm) && pupilMm > 0) {
      const pupilStop = new ApertureStopSurface({
        type: "aperture_stop",
        name: "pupil_stop",
        shape: "circle",
        radius: pupilMm / 2,
        position: {
          x: 0,
          y: 0,
          z: -EYE_ST_SURFACE_OFFSET_MM - (2 * RAY_SURFACE_ESCAPE_MM),
        },
        tilt: { x: 0, y: 0 },
      });
      surfaces.unshift(pupilStop);
    }

    applyRigidEyePoseToSurfaces(surfaces, eyeRotationPivot(), rotation);
    return surfaces;
  }
}
