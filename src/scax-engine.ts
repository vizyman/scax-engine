import { Vector3 } from "three";
import Affine, { AffinePair } from "./affine/affine";
import {
  GridLightSource,
  GridLightSourceProps,
  GridRGLightSource,
  GridRGLightSourceProps,
  LightSource,
  RadialLightSource,
  RadialLightSourceProps,
} from "./light-sources/light-source";
import {
  DEFAULT_STURM_PROFILE_WORLD_Z_PAST_RETINA_MM,
  FRAUNHOFER_REFRACTIVE_INDICES,
  PUPIL_SIZE,
  SPECTACLE_VERTEX_DISTANCE_MM,
} from "./parameters/constants";
import { eyeRotationForRenderDegrees } from "./parameters/eye/eye-rigid-pose";
import { EyeModelParameter } from "./parameters/eye/eyemodel-parameter";
import { GullstrandParameter } from "./parameters/eye/gullstrand-parameter";
import { NavarroParameter } from "./parameters/eye/navarro-parameter";
import Ray from "./ray/ray";
import Sturm, { type SturmProfileWorldZBounds } from "./sturm/sturm";
import STSurface from "./surfaces/st-surface";
import Surface from "./surfaces/surface";

export type EyeModel = "gullstrand" | "navarro";
export type PupilType = "constricted" | "neutral" | "dilated" | "none";

// ================ Light source config ================
export type LightSourceConfig =
  | ({ type: "radial" } & RadialLightSourceProps & LightSourceTransform)
  | ({ type: "grid" } & GridLightSourceProps & LightSourceTransform)
  | ({ type: "grid_rg" } & GridRGLightSourceProps & LightSourceTransform);


export type LightSourceTransform = {
  position?: { x?: number; y?: number; z?: number };
  tilt?: { x?: number; y?: number };
};

const DEFAULT_LIGHT_SOURCE_CONFIG: LightSourceConfig = {
  type: "grid",
  width: 10,
  height: 10,
  division: 4,
  z: -10,
  vergence: 0,
};

export type NormalizedLightSourceConfig = LightSourceConfig & {
  position: { x: number; y: number; z: number };
  tilt: { x: number; y: number };
};


// ================ Lens config ================
export type LensConfig = {
  s: number;
  c: number;
  ax: number;
  p?: number;
  p_ax?: number;
  position: { x: number; y: number; z: number };
  tilt: { x: number; y: number };
};

export type NormalizedLensConfig = LensConfig & {
  p: number;
  p_ax: number;
};

// ================ Eye config ================
export type EyeConfig = {
  s: number;
  c: number;
  ax: number;
  p?: number;
  p_ax?: number;
  tilt?: { x?: number; y?: number };
};
export type EyePowerInput = EyeConfig;

export type NormalizedEyeConfig = EyeConfig & {
  p: number;
  p_ax: number;
  tilt: { x: number; y: number };
};

// ================ Default config ================

// ================ SCAXEngineProps ================
export type SCAXEngineProps = {
  eyeModel?: EyeModel;
  eye?: EyeConfig;
  lens?: LensConfig[];
  light_source?: LightSourceConfig;
  pupil_type?: PupilType;
};

export type NormalizedEngineConfig = {
  eyeModel: EyeModel;
  eye: NormalizedEyeConfig;
  lens: NormalizedLensConfig[];
  light_source: NormalizedLightSourceConfig;
  pupil_type: PupilType;
};

// ================ Helper functions ================
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

function normalizeEyeTilt(value: EyeConfig["tilt"]) {
  return {
    x: toFiniteNumber(value?.x),
    y: toFiniteNumber(value?.y),
  };
}

function normalizeLightSourcePose(value: LightSourceConfig) {
  return {
    position: {
      x: toFiniteNumber(value?.position?.x),
      y: toFiniteNumber(value?.position?.y),
      z: toFiniteNumber(value?.position?.z),
    },
    tilt: {
      x: toFiniteNumber(value?.tilt?.x),
      y: toFiniteNumber(value?.tilt?.y),
    },
  };
}

function isNormalizedEngineConfig(config: SCAXEngineProps | NormalizedEngineConfig): config is NormalizedEngineConfig {
  const candidate = config as Partial<NormalizedEngineConfig>;
  return (
    candidate.eyeModel !== undefined
    && candidate.eye !== undefined
    && candidate.light_source !== undefined
    && candidate.pupil_type !== undefined
    && Array.isArray(candidate.lens)
  );
}

export function normalizeEngineProps(props: SCAXEngineProps = {}): NormalizedEngineConfig {
  const eyeModel = props.eyeModel ?? "gullstrand";
  const eyeInput = props.eye ?? { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 };
  const lensInput = Array.isArray(props.lens) ? props.lens : [];
  const lightSourceInput = props.light_source ?? DEFAULT_LIGHT_SOURCE_CONFIG;
  const normalizedLightSourcePose = normalizeLightSourcePose(lightSourceInput);
  return {
    eyeModel,
    eye: {
      s: toFiniteNumber(eyeInput?.s),
      c: toFiniteNumber(eyeInput?.c),
      ax: toFiniteNumber(eyeInput?.ax),
      p: normalizePrismAmount(eyeInput?.p),
      p_ax: normalizeAngle360(eyeInput?.p_ax),
      tilt: normalizeEyeTilt(eyeInput?.tilt),
    },
    lens: lensInput.map((spec) => ({
      s: toFiniteNumber(spec?.s),
      c: toFiniteNumber(spec?.c),
      ax: toFiniteNumber(spec?.ax),
      p: normalizePrismAmount(spec?.p),
      p_ax: normalizeAngle360(spec?.p_ax),
      position: {
        x: toFiniteNumber(spec?.position?.x),
        y: toFiniteNumber(spec?.position?.y),
        z: toFiniteNumber(spec?.position?.z, SPECTACLE_VERTEX_DISTANCE_MM),
      },
      tilt: {
        x: toFiniteNumber(spec?.tilt?.x),
        y: toFiniteNumber(spec?.tilt?.y),
      },
    })),
    light_source: {
      ...lightSourceInput,
      position: { ...normalizedLightSourcePose.position },
      tilt: { ...normalizedLightSourcePose.tilt },
    } as NormalizedLightSourceConfig,
    pupil_type: props.pupil_type ?? "neutral",
  };
}

// export type SCAxPower = { s: number; c: number; ax: number };

export type SimulateResult = {
  traced_rays: Ray[];
};

export type MeridianInfo = { tabo: number; d: number }[];

// export type PrismSummaryItem = {
//   p_x: number;
//   p_y: number;
//   prism_angle: number;
//   magnitude: number | null;
// };

// export type EyePrismSummaryItem = PrismSummaryItem & {
//   rot_x: number;
//   rot_y: number;
//   rot_magnitude: number;
// };

// /** `getMeridiansInfo()` — 렌즈별 주경선은 `byLens` */
// export type MeridiansInfo = {
//   eye: MeridianInfo;
//   lens: MeridianInfo[];
//   combined: MeridianInfo;
//   byLens: MeridianInfo[];
// };

// /** `getEyePrismInfo()` */
// export type EyePrismInfo = EyePrismSummaryItem;

export type AffineAnalysisResult = ReturnType<Affine["estimate"]>;

/**
 * legacy simulator.js를 TypeScript로 옮긴 핵심 시뮬레이터입니다.
 * - 광원 광선을 생성하고
 * - 표면들을 순서대로 통과시키며 굴절을 계산한 뒤
 * - Sturm 분석까지 제공합니다.
 */
export class SCAXEngineCore {
  private surfaces!: Surface[]; // eye model surfaces
  private lens!: Surface[]; // external spectacle lens surfaces
  private light_source!: LightSource;
  private _eyeModelParameter!: EyeModelParameter;
  private tracedRays: Ray[] = [];
  private lastSourceRaysForSturm: Ray[] = [];
  private sturm: Sturm;
  private affine: Affine;
  private lastSturmGapAnalysis: ReturnType<Sturm["calculate"]> | null = null;
  private lastAffineAnalysis: ReturnType<Affine["estimate"]> = null;
  private sortedLensSurfaces: Surface[] = [];
  private sortedEyeSurfaces: Surface[] = [];

  get eyeModelParameter(): EyeModelParameter {
    return this._eyeModelParameter;
  }

  constructor(config: SCAXEngineProps | NormalizedEngineConfig = {}) {
    this.sturm = new Sturm();
    this.affine = new Affine();
    this.configure(isNormalizedEngineConfig(config) ? config : normalizeEngineProps(config));
  }

  /**
   * 생성자와 동일한 기본값 규칙으로 광학 설정을 다시 적용합니다.
   * 생략한 최상위 필드는 매번 기본값으로 돌아갑니다(이전 값과 병합하지 않음).
   */
  public update(config: SCAXEngineProps | NormalizedEngineConfig = {}) {
    this.configure(isNormalizedEngineConfig(config) ? config : normalizeEngineProps(config));
  }

  public dispose() {
    [...this.lens, ...this.surfaces].forEach((surface) => {
      surface.clearTraceHistory();
    });
    this.tracedRays = [];
    this.lastSourceRaysForSturm = [];
    this.lastSturmGapAnalysis = null;
    this.lastAffineAnalysis = null;
    this.surfaces = [];
    this.lens = [];
    this.sortedEyeSurfaces = [];
    this.sortedLensSurfaces = [];
  }

  private configure(config: NormalizedEngineConfig) {
    this.lastSturmGapAnalysis = null;
    this.lastAffineAnalysis = null;
    const { eyeModel, eye, lens, light_source, pupil_type } = config;
    const lensConfigs: NormalizedLensConfig[] = lens.map((spec) => ({
      s: spec.s,
      c: spec.c,
      ax: spec.ax,
      p: spec.p,
      p_ax: spec.p_ax,
      position: {
        x: spec.position.x,
        y: spec.position.y,
        z: spec.position.z,
      },
      tilt: {
        x: spec.tilt.x,
        y: spec.tilt.y,
      },
    }));
    // "none"은 동공 제한을 완전히 비활성화합니다.
    const pupilMm = pupil_type === "none" ? 0 : Number(PUPIL_SIZE[pupil_type]);
    this._eyeModelParameter = eyeModel === "gullstrand" ? new GullstrandParameter() : new NavarroParameter();
    this.surfaces = this._eyeModelParameter.createSurface({
      eyeModel,
      s: eye.s,
      c: eye.c,
      ax: eye.ax,
      p: eye.p,
      p_ax: eye.p_ax,
      tilt: eye.tilt,
      pupilDiameterMm: pupilMm,
    });
    this.lens = lensConfigs.map((spec, index) => new STSurface({
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
      p: spec.p,
      p_ax: spec.p_ax,
    }));
    this.light_source = light_source.type === "radial"
      ? new RadialLightSource(light_source as unknown as RadialLightSourceProps)
      : light_source.type === "grid_rg"
        ? new GridRGLightSource(light_source as unknown as GridRGLightSourceProps)
        : new GridLightSource(light_source as unknown as GridLightSourceProps);
    this.refreshSortedSurfaces();
  }

  /**
   * 기본 시뮬레이션 진입점입니다.
   * includeSturmData 값과 무관하게 확장 분석(Sturm/retinaPairs)을 항상 포함합니다.
   */
  public simulate(): SimulateResult {
    const tracedRays = this.rayTracing();
    this.sturmCalculation(tracedRays);
    return { traced_rays: tracedRays };
  }

  /**
   * 1) Ray tracing 전용 함수
   * 광원에서 시작한 광선을 표면 순서대로 굴절시켜 최종 광선 집합을 반환합니다.
   */
  public rayTracing(): Ray[] {
    const lensSurfaces = this.sortedLensSurfaces;
    const eyeSurfaces = this.sortedEyeSurfaces;
    lensSurfaces.forEach((surface) => surface.clearTraceHistory());
    eyeSurfaces.forEach((surface) => surface.clearTraceHistory());
    const emittedSourceRays = this.light_source.emitRays();
    const sourceRays = emittedSourceRays;
    this.lastSourceRaysForSturm = sourceRays.map((ray) => ray.clone());
    const traced: Ray[] = [];

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
        if (this.getRayPoints(activeRay).length >= 2) traced.push(activeRay);
        continue;
      }
      for (const surface of eyeSurfaces) {
        const nextRay = surface.refract(activeRay);
        if (!(nextRay instanceof Ray)) {
          valid = false;
          break;
        }
        activeRay = nextRay;
      }

      if (valid) {
        traced.push(activeRay);
      } else if (this.getRayPoints(activeRay).length >= 2) {
        // 일부 면에서 실패하더라도 실패 지점까지의 실제 광로는 시각화에 남깁니다.
        traced.push(activeRay);
      }
    }

    this.tracedRays = traced;
    return traced;
  }



  /**
   * Sturm 선초/근사중심에 사용할 슬라이스 centroid(world z) 구간:
   * 각막 전면(cornea_anterior) 이상 ~ 망막(retina) + 여유 이하.
   */
  private sturmEyeProfileWorldZBounds(): SturmProfileWorldZBounds | undefined {
    let corneaAnteriorZ = Number.POSITIVE_INFINITY;
    let retinaZ = Number.NEGATIVE_INFINITY;
    for (const surface of this.surfaces) {
      const name = String((surface as unknown as { name?: string }).name || "").toLowerCase();
      const z = Number(this.readSurfacePosition(surface)?.z);
      if (!Number.isFinite(z)) continue;
      if (name.includes("cornea") && name.includes("anterior")) {
        corneaAnteriorZ = Math.min(corneaAnteriorZ, z);
      }
      if (name === "retina") {
        retinaZ = Math.max(retinaZ, z);
      }
    }
    if (!Number.isFinite(corneaAnteriorZ) || !Number.isFinite(retinaZ)) return undefined;
    if (retinaZ + 1e-9 < corneaAnteriorZ) return undefined;
    return {
      zMin: corneaAnteriorZ,
      zMax: retinaZ + DEFAULT_STURM_PROFILE_WORLD_Z_PAST_RETINA_MM,
    };
  }

  /**
   * 2) Sturm calculation 전용 함수
   * traced ray 집합에서 z-scan 기반 Sturm 슬라이스/근사 중심을 계산합니다.
   */
  public sturmCalculation(
    rays: Ray[] = this.tracedRays,
  ) {
    this.lastSturmGapAnalysis = this.sturm.calculate(
      rays,
      this.effectiveCylinderFromOpticSurfaces(),
      this.lastSourceRaysForSturm,
      this.sturmEyeProfileWorldZBounds() ?? null,
    );
    return this.lastSturmGapAnalysis;
  }

  public getAffineAnalysis(): AffineAnalysisResult {
    /*
    if (!this.tracedRays.length) {
      this.simulate();
    }
    if (!this.lastAffineAnalysis) {
      this.lastAffineAnalysis = this.estimateAffineDistortion(this.createAffinePairs(this.tracedRays));
    }
    return this.lastAffineAnalysis;
    */
    // Affine analysis is intentionally disabled for now.
    return null;
  }

  private surfaceOrderZ(surface: Surface) {
    const z = Number(this.readSurfacePosition(surface)?.z);
    return Number.isFinite(z) ? z : 0;
  }

  private readSurfacePosition(surface: Surface) {
    return (surface as unknown as { position?: Vector3 }).position;
  }

  private getRayPoints(ray: Ray) {
    const points = (ray as unknown as { points?: Vector3[] }).points;
    return Array.isArray(points) ? points : [];
  }

  private powerVectorFromCylinder(cylinderD: number, axisDeg: number) {
    const c = Number(cylinderD);
    const ax = ((Number(axisDeg) % 180) + 180) % 180;
    if (!Number.isFinite(c)) return { j0: 0, j45: 0 };
    const rad = (2 * ax * Math.PI) / 180;
    const scale = -c / 2;
    return { j0: scale * Math.cos(rad), j45: scale * Math.sin(rad) };
  }

  private refreshSortedSurfaces() {
    this.sortedLensSurfaces = [...this.lens].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
    this.sortedEyeSurfaces = [...this.surfaces].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
  }

  private effectiveCylinderFromOpticSurfaces() {
    let j0 = 0;
    let j45 = 0;
    for (const surface of [...this.lens, ...this.surfaces]) {
      const s = surface as unknown as { c?: number; ax?: number };
      const c = Number(s.c);
      const ax = Number(s.ax);
      if (!Number.isFinite(c) || Math.abs(c) < 1e-12 || !Number.isFinite(ax)) continue;
      const v = this.powerVectorFromCylinder(c, ax);
      j0 += v.j0;
      j45 += v.j45;
    }
    return 2 * Math.hypot(j0, j45);
  }

  // Kept for later review/release.
  private estimateAffineDistortion(pairs: AffinePair[]) {
    const inputPairs = Array.isArray(pairs) ? pairs : [];
    this.lastAffineAnalysis = this.affine.estimate(inputPairs);
    return this.lastAffineAnalysis;
  }

  // Kept for later review/release.
  private createAffinePairs(rays: Ray[]): AffinePair[] {
    return (Array.isArray(rays) ? rays : [])
      .map((ray) => {
        const points = this.getRayPoints(ray);
        if (!Array.isArray(points) || points.length < 2) return null;
        const source = points[0];
        const target = points[points.length - 1];
        const sx = Number(source?.x);
        const sy = Number(source?.y);
        const tx = Number(target?.x);
        const ty = Number(target?.y);
        if (
          !Number.isFinite(sx)
          || !Number.isFinite(sy)
          || !Number.isFinite(tx)
          || !Number.isFinite(ty)
        ) {
          return null;
        }
        return { sx, sy, tx, ty };
      })
      .filter((pair): pair is AffinePair => Boolean(pair));
  }

}

/**
 * 외부 공개 API 전용 Facade입니다.
 * 내부 광학 상태/연산은 SCAXEngineCore에 위임합니다.
 */
export default class SCAXEngine {
  private readonly core: SCAXEngineCore;
  private normalizedConfig: NormalizedEngineConfig;

  constructor(props: SCAXEngineProps = {}) {
    this.normalizedConfig = normalizeEngineProps(props);
    this.core = new SCAXEngineCore(this.normalizedConfig);
  }

  // Test/debug bridge for legacy direct field access patterns.
  public get lens() {
    return (this.core as unknown as { lens: Surface[] }).lens;
  }

  public get light_source() {
    return (this.core as unknown as { light_source: LightSource }).light_source;
  }

  public get surfaces() {
    return (this.core as unknown as { surfaces: Surface[] }).surfaces;
  }

  public update(props: SCAXEngineProps = {}) {
    this.normalizedConfig = normalizeEngineProps(props);
    this.core.update(this.normalizedConfig);
  }

  public dispose() {
    this.core.dispose();
  }

  // public getMeridiansInfo(): MeridiansInfo {
  //   const summarizePowers = (powers: SCAxPower[]): MeridianInfo => {
  //     let m = 0;
  //     let j0 = 0;
  //     let j45 = 0;
  //     for (const power of powers) {
  //       const sphere = Number(power?.s ?? 0);
  //       const cylinder = Number(power?.c ?? 0);
  //       const axisTABO = Number(power?.ax ?? 0);
  //       if (!Number.isFinite(sphere) || !Number.isFinite(cylinder) || !Number.isFinite(axisTABO)) continue;
  //       const axisDeg = TABOToDeg(axisTABO);
  //       const rad = (2 * axisDeg * Math.PI) / 180;
  //       const halfMinusCylinder = -cylinder / 2;
  //       m += sphere + (cylinder / 2);
  //       j0 += halfMinusCylinder * Math.cos(rad);
  //       j45 += halfMinusCylinder * Math.sin(rad);
  //     }
  //     if (!Number.isFinite(m) || !Number.isFinite(j0) || !Number.isFinite(j45)) return [];
  //     const axisDeg = (((0.5 * Math.atan2(j45, j0) * 180) / Math.PI) % 180 + 180) % 180;
  //     const taboAxis = ((DegToTABO(axisDeg) % 180) + 180) % 180;
  //     const orthogonalTabo = (taboAxis + 90) % 180;
  //     const r = Math.hypot(j0, j45);
  //     return [
  //       { tabo: taboAxis, d: m - r },
  //       { tabo: orthogonalTabo, d: m + r },
  //     ].sort((a, b) => a.d - b.d);
  //   };
  //   const toFinitePower = (power: SCAxPower): SCAxPower => ({
  //     s: Number.isFinite(Number(power.s)) ? Number(power.s) : 0,
  //     c: Number.isFinite(Number(power.c)) ? Number(power.c) : 0,
  //     ax: Number.isFinite(Number(power.ax)) ? Number(power.ax) : 0,
  //   });

  //   const eyeConfig = this.normalizedConfig.eye;
  //   const eyePower: SCAxPower = {
  //     s: -(eyeConfig.s + (this.normalizedConfig.eyeModel === "gullstrand" ? -1 : 0)),
  //     c: -eyeConfig.c,
  //     ax: eyeConfig.ax,
  //   };
  //   const lensPowers: SCAxPower[] = this.normalizedConfig.lens.map((spec) => ({
  //     s: spec.s,
  //     c: spec.c,
  //     ax: spec.ax,
  //   }));
  //   const lensSummaryPowers: SCAxPower[] = this.normalizedConfig.lens
  //     .map((spec) => ({
  //       s: spec.s,
  //       c: spec.c,
  //       ax: spec.ax,
  //     }));
  //   const eye = summarizePowers([eyePower]);
  //   const byLens: MeridianInfo[] = [];
  //   for (const lp of lensSummaryPowers) {
  //     byLens.push(summarizePowers([toFinitePower(lp)]));
  //   }
  //   const lens = byLens;
  //   const combinedPowers: SCAxPower[] = [eyePower, ...lensPowers.map(toFinitePower)];
  //   const combined = summarizePowers(combinedPowers);
  //   return { eye, lens, combined, byLens };
  // }

  // public getEyePrismInfo(): EyePrismInfo {
  //   const eyeConfig = this.normalizedConfig.eye;
  //   const eyePrismEffectVector = eyePrismEffectVectorFromPrescription(
  //     eyeConfig.p,
  //     eyeConfig.p_ax,
  //   );
  //   const ex = Number.isFinite(eyePrismEffectVector.x) ? eyePrismEffectVector.x : 0;
  //   const ey = Number.isFinite(eyePrismEffectVector.y) ? eyePrismEffectVector.y : 0;
  //   const eyeMag = Math.hypot(ex, ey);
  //   const eyeRot = eyeRotationForRenderDegrees(
  //     eyeConfig.p,
  //     eyeConfig.p_ax,
  //     eyeConfig.tilt,
  //   );
  //   const rotX = Number.isFinite(eyeRot.x_deg) ? eyeRot.x_deg : 0;
  //   const rotY = Number.isFinite(eyeRot.y_deg) ? eyeRot.y_deg : 0;
  //   const rotMagnitude = Number.isFinite(eyeRot.magnitude_deg) ? eyeRot.magnitude_deg : 0;
  //   const eyeAngleRaw = (Math.atan2(rotY, rotX) * 180) / Math.PI;
  //   const eyeAngleDeg = rotMagnitude < 1e-12 ? 0 : ((eyeAngleRaw % 360) + 360) % 360;
  //   const eyeMagNorm = Number(eyeMag);
  //   const eye: EyePrismSummaryItem = {
  //     p_x: ex,
  //     p_y: ey,
  //     prism_angle: ((eyeAngleDeg % 360) + 360) % 360,
  //     magnitude: Number.isFinite(eyeMagNorm) && eyeMagNorm >= 1e-9 ? eyeMagNorm : null,
  //     rot_x: rotX,
  //     rot_y: rotY,
  //     rot_magnitude: rotMagnitude,
  //   };
  //   return eye;
  // }

  public simulate(): SimulateResult {
    return this.core.simulate();
  }

  public rayTracing(): Ray[] {
    return this.core.rayTracing();
  }

  public sturmCalculation(rays?: Ray[]) {
    return this.core.sturmCalculation(rays);
  }

  public calculateMeridians(scaxPowers: { s: number, c: number, ax: number }[]): MeridianInfo {
    const normalize180 = (angle: number) => (((angle % 180) + 180) % 180);
    const taboToDeg = (taboAngle: number) => normalize180(180 - taboAngle);
    const degToTabo = (degreeAngle: number) => normalize180(180 - degreeAngle);

    let m = 0;
    let j0 = 0;
    let j45 = 0;

    for (const power of Array.isArray(scaxPowers) ? scaxPowers : []) {
      const sphere = Number(power?.s ?? 0);
      const cylinder = Number(power?.c ?? 0);
      const axisTABO = Number(power?.ax ?? 0);
      if (!Number.isFinite(sphere) || !Number.isFinite(cylinder) || !Number.isFinite(axisTABO)) continue;
      const axisDeg = taboToDeg(axisTABO);
      const rad = (2 * axisDeg * Math.PI) / 180;
      const halfMinusCylinder = -cylinder / 2;
      m += sphere + (cylinder / 2);
      j0 += halfMinusCylinder * Math.cos(rad);
      j45 += halfMinusCylinder * Math.sin(rad);
    }

    if (!Number.isFinite(m) || !Number.isFinite(j0) || !Number.isFinite(j45)) return [];

    const axisDeg = normalize180((0.5 * Math.atan2(j45, j0) * 180) / Math.PI);
    const taboAxis = degToTabo(axisDeg);
    const orthogonalTabo = (taboAxis + 90) % 180;
    const r = Math.hypot(j0, j45);

    return [
      { tabo: taboAxis, d: m - r },
      { tabo: orthogonalTabo, d: m + r },
    ].sort((a, b) => a.d - b.d);
  }

  public calculateEyeRotationByPrism(prism: { p: number, p_ax: number }): { x: number, y: number } {
    // 프리즘 처방으로 인한 안구 회전량만 계산 (tilt 제외)
    const p = normalizePrismAmount(prism?.p);
    const p_ax = normalizeAngle360(prism?.p_ax);
    const rotation = eyeRotationForRenderDegrees(p, p_ax, { x: 0, y: 0 });
    return {
      x: Number.isFinite(rotation.x_deg) ? rotation.x_deg : 0,
      y: Number.isFinite(rotation.y_deg) ? rotation.y_deg : 0,
    };
  }

  // public getAffineAnalysis(): AffineAnalysisResult {
  //   return this.core.getAffineAnalysis();
  // }
}
