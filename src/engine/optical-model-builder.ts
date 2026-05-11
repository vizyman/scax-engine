import { Euler, Quaternion, Vector3 } from "three";
import {
  GridLightSource,
  GridLightSourceProps,
  GridRGLightSource,
  GridRGLightSourceProps,
  LightSource,
  RadialLightSource,
  RadialLightSourceProps,
} from "../light-sources/light-source";
import {
  EYE_ST_SURFACE_OFFSET_MM,
  FRAUNHOFER_REFRACTIVE_INDICES,
  PUPIL_SIZE,
  RAY_SURFACE_ESCAPE_MM,
} from "../parameters/constants";
import { EyeModelParameter } from "../parameters/eye/eyemodel-parameter";
import { GullstrandParameter } from "../parameters/eye/gullstrand-parameter";
import { NavarroParameter } from "../parameters/eye/navarro-parameter";
import { prismComponentToAngleDeg, prismVectorFromBase } from "../optics/prism";
import ApertureStopSurface from "../surfaces/aperture-stop-surface";
import STSurface from "../surfaces/st-surface";
import Surface from "../surfaces/surface";
import type { EyeModel, SCAxPower } from "../scax-engine";
import { toFiniteNumber, type NormalizedEngineConfig, type NormalizedLensConfig } from "./engine-config";

export type OpticalModelState = {
  eyeModel: EyeModel;
  surfaces: Surface[];
  lens: Surface[];
  lightSource: LightSource;
  eyeModelParameter: EyeModelParameter;
  pupilDiameterMm: number | null;
  hasPupilStop: boolean;
  eyePower: SCAxPower;
  lensConfigs: NormalizedLensConfig[];
  lensPowers: SCAxPower[];
  eyePrismEffectVector: { x: number; y: number };
  lensPrismVector: { x: number; y: number };
  eyePrismPrescription: { p: number; p_ax: number };
  eyeRotationQuaternion: Quaternion;
  eyeRotationQuaternionInverse: Quaternion;
  eyeRotationPivot: Vector3;
  eyeTiltDeg: { x: number; y: number };
  lightSourcePosition: Vector3;
  lightSourceTiltDeg: { x: number; y: number };
  lightSourceRotationQuaternion: Quaternion;
  lightSourceRotationPivot: Vector3;
};

export function buildOpticalModel(
  config: NormalizedEngineConfig,
  eyeRotationPivotFromCorneaMm: number,
): OpticalModelState {
  const { eyeModel, eye, lens, light_source, pupil_type } = config;
  const normalizedEyeSphere = eye.s + (eyeModel === "gullstrand" ? -1 : 0);
  const eyePower = {
    s: -normalizedEyeSphere,
    c: -eye.c,
    ax: eye.ax,
  };
  const eyePrismPrescription = {
    p: eye.p,
    p_ax: eye.p_ax,
  };
  const eyeRx = prismVectorFromBase(eyePrismPrescription.p, eyePrismPrescription.p_ax);
  // eye 입력은 "교정 필요량(처방값)"이므로 실제 안구 편위는 역벡터입니다.
  const eyePrismEffectVector = { x: -eyeRx.x, y: -eyeRx.y };
  const eyeRotXDeg = prismComponentToAngleDeg(eyePrismEffectVector.x);
  const eyeRotYDeg = prismComponentToAngleDeg(eyePrismEffectVector.y);
  const eyeTiltDeg = { ...eye.tilt };
  // Apply eye deviation in the opposite direction so a lens with the same
  // prism/base prescription can optically compensate the eye deviation.
  const eyeEulerXDeg = eyeRotYDeg + eyeTiltDeg.x;
  const eyeEulerYDeg = (-eyeRotXDeg) + eyeTiltDeg.y;
  const eyeRotationQuaternion = new Quaternion().setFromEuler(new Euler(
    (eyeEulerXDeg * Math.PI) / 180,
    (eyeEulerYDeg * Math.PI) / 180,
    0,
    "XYZ",
  ));
  const eyeRotationQuaternionInverse = eyeRotationQuaternion.clone().invert();
  const eyeRotationPivot = new Vector3(0, 0, eyeRotationPivotFromCorneaMm);

  const lightSourcePosition = new Vector3(
    light_source.position.x,
    light_source.position.y,
    light_source.position.z,
  );
  const lightSourceTiltDeg = { ...light_source.tilt };
  const lightSourceRotationQuaternion = new Quaternion().setFromEuler(new Euler(
    (lightSourceTiltDeg.x * Math.PI) / 180,
    (lightSourceTiltDeg.y * Math.PI) / 180,
    0,
    "XYZ",
  ));
  // Rotate around the light source local center plane (z), not world origin.
  const lightSourceRotationPivot = new Vector3(0, 0, toFiniteNumber((light_source as { z?: number })?.z));

  const lensConfigs = lens.map((spec) => ({
    ...spec,
    position: { ...spec.position },
    tilt: { ...spec.tilt },
  }));
  const lensPowers = lensConfigs.map((spec) => ({
    s: spec.s,
    c: spec.c,
    ax: spec.ax,
  }));
  // eye/lens prism axis는 모두 임상 Base 방향(렌즈->각막 시점)으로 입력합니다.
  // 내부 광선 편향 벡터는 Base의 반대방향(= +180deg 변환)으로 계산합니다.
  const lensPrismVector = lensConfigs.reduce((acc, spec) => {
    const v = prismVectorFromBase(spec.p, spec.p_ax);
    return { x: acc.x + v.x, y: acc.y + v.y };
  }, { x: 0, y: 0 });

  const pupilDiameterMm = pupil_type === "none" ? 0 : Number(PUPIL_SIZE[pupil_type]);
  const eyeModelParameter = eyeModel === "gullstrand" ? new GullstrandParameter() : new NavarroParameter();
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
  let surfaces: Surface[] = [eyeSt, ...eyeModelParameter.createSurface()];
  let hasPupilStop = false;
  if (Number.isFinite(pupilDiameterMm) && pupilDiameterMm > 0) {
    const pupilStop = new ApertureStopSurface({
      type: "aperture_stop",
      name: "pupil_stop",
      shape: "circle",
      radius: pupilDiameterMm / 2,
      // eye_st(눈 굴절력 surface)의 첫 굴절면(back vertex) 바로 앞에서 차단/통과를 판정합니다.
      position: {
        x: 0,
        y: 0,
        z: -EYE_ST_SURFACE_OFFSET_MM - (2 * RAY_SURFACE_ESCAPE_MM),
      },
      tilt: { x: 0, y: 0 },
    });
    surfaces = [pupilStop, ...surfaces];
    hasPupilStop = true;
  }

  const lensSurfaces = lensConfigs.map((spec, index) => new STSurface({
    type: "compound",
    name: `lens_st_${index + 1}`,
    position: {
      x: spec.position.x,
      y: spec.position.y,
      z: spec.position.z,
    },
    tilt: { x: spec.tilt.x, y: spec.tilt.y },
    // Spectacle ST rule:
    // 1) back surface is fixed at vertex distance(position.z)
    // 2) back-front gap is optimized (thickness=0 => auto)
    thickness: 0,
    s: spec.s,
    c: spec.c,
    ax: spec.ax,
    n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
    n: FRAUNHOFER_REFRACTIVE_INDICES.crown_glass,
    n_after: FRAUNHOFER_REFRACTIVE_INDICES.air,
  }));
  const lightSource = light_source.type === "radial"
    ? new RadialLightSource(light_source as RadialLightSourceProps)
    : light_source.type === "grid_rg"
      ? new GridRGLightSource(light_source as GridRGLightSourceProps)
      : new GridLightSource(light_source as GridLightSourceProps);

  return {
    eyeModel,
    surfaces,
    lens: lensSurfaces,
    lightSource,
    eyeModelParameter,
    pupilDiameterMm,
    hasPupilStop,
    eyePower,
    lensConfigs,
    lensPowers,
    eyePrismEffectVector,
    lensPrismVector,
    eyePrismPrescription,
    eyeRotationQuaternion,
    eyeRotationQuaternionInverse,
    eyeRotationPivot,
    eyeTiltDeg,
    lightSourcePosition,
    lightSourceTiltDeg,
    lightSourceRotationQuaternion,
    lightSourceRotationPivot,
  };
}
