import { Quaternion, Vector3 } from "three";
import {
  LightSource,
  type GridLightSourceProps,
  type GridRGLightSourceProps,
  type RadialLightSourceProps,
} from "./light-sources/light-source";
import {
  DEFAULT_STURM_PROFILE_WORLD_Z_PAST_RETINA_MM,
} from "./parameters/constants";
import {
  normalizeEngineProps,
  type NormalizedEngineConfig,
  type NormalizedLensConfig,
} from "./engine/engine-config";
import { buildOpticalModel } from "./engine/optical-model-builder";
import { traceRaysThroughOpticalSystem } from "./engine/ray-tracer";
import { buildSimulationInfo } from "./engine/simulation-summary";
import { EyeModelParameter } from "./parameters/eye/eyemodel-parameter";
import Ray from "./ray/ray";
import Sturm, { type SturmProfileWorldZBounds } from "./sturm/sturm";
import Surface from "./surfaces/surface";
import { powerVectorFromCylinder } from "./optics/power-vector";
import {
  prismComponentToAngleDeg,
} from "./optics/prism";

export type EyeModel = "gullstrand" | "navarro";
export type PupilType = "constricted" | "neutral" | "dilated" | "none";

export type LightSourceTransform = {
  position?: { x?: number; y?: number; z?: number };
  tilt?: { x?: number; y?: number };
};

export type LightSourceConfig =
  | ({ type: "radial" } & RadialLightSourceProps & LightSourceTransform)
  | ({ type: "grid" } & GridLightSourceProps & LightSourceTransform)
  | ({ type: "grid_rg" } & GridRGLightSourceProps & LightSourceTransform);

export type LensConfig = {
  s: number;
  c: number;
  ax: number;
  p?: number;
  p_ax?: number;
  position: { x: number; y: number; z: number };
  tilt: { x: number; y: number };
  /**
   * true이면 JCC/크로스실린더 등 시험용 렌즈로 간주하여
   * `simulate().info.astigmatism.lens` 파워 벡터 합에서는 제외합니다(광선 추적·`combined` 요약에는 그대로 포함).
   * @default false
   */
  isXCyl?: boolean;
};

export type EyeConfig = {
  s: number;
  c: number;
  ax: number;
  p?: number;
  p_ax?: number;
  tilt?: { x?: number; y?: number };
};
export type EyePowerInput = EyeConfig;

export type SCAXEngineProps = {
  eyeModel?: EyeModel;
  eye?: EyeConfig;
  lens?: LensConfig[];
  light_source?: LightSourceConfig;
  pupil_type?: PupilType;
};

export type SCAxPower = { s: number; c: number; ax: number };

export type SimulateResult = {
  traced_rays: Ray[];
  info: SimulationResultInfo;
};

export type PrismVector = { x: number; y: number; magnitude: number; angle_deg: number };

export type EyeRotationForRender = {
  x_deg: number;
  y_deg: number;
  magnitude_deg: number;
};

export type LightDeviation = {
  eye_prism_effect: PrismVector;
  lens_prism_total: PrismVector;
  net_prism: PrismVector;
  x_angle_deg: number;
  y_angle_deg: number;
  net_angle_deg: number;
};

export type AstigmatismSummaryItem = { tabo: number; d: number }[];

export type PrismSummaryItem = {
  p_x: number;
  p_y: number;
  prism_angle: number;
  magnitude: number | null;
};

export type SimulationResultInfo = {
  astigmatism: {
    eye: AstigmatismSummaryItem;
    lens: AstigmatismSummaryItem;
    combined: AstigmatismSummaryItem;
  };
  prism: {
    eye: PrismSummaryItem;
    lens: PrismSummaryItem;
    combined: PrismSummaryItem;
  };
};

/**
 * legacy simulator.js를 TypeScript로 옮긴 핵심 시뮬레이터입니다.
 * - 광원 광선을 생성하고
 * - 표면들을 순서대로 통과시키며 굴절을 계산한 뒤
 * - Sturm 분석까지 제공합니다.
 */
export class SCAXEngineCore {
  private static readonly EYE_ROTATION_PIVOT_FROM_CORNEA_MM = 13;
  private eyeModel!: EyeModel;
  private surfaces!: Surface[]; // eye model surfaces
  private lens!: Surface[]; // external spectacle lens surfaces
  private light_source!: LightSource;
  private eyeModelParameter!: EyeModelParameter;
  private tracedRays: Ray[] = [];
  private lastSourceRaysForSturm: Ray[] = [];
  private sturm: Sturm;
  private lastSturmGapAnalysis: ReturnType<Sturm["calculate"]> | null = null;
  private pupilDiameterMm!: number | null;
  private hasPupilStop!: boolean;
  private eyePower!: SCAxPower;
  private lensConfigs!: NormalizedLensConfig[];
  private lensPowers!: SCAxPower[];
  private eyePrismEffectVector!: { x: number; y: number };
  private lensPrismVector!: { x: number; y: number };
  private eyePrismPrescription!: { p: number; p_ax: number };
  private eyeRotationQuaternion!: Quaternion;
  private eyeRotationQuaternionInverse!: Quaternion;
  private eyeRotationPivot!: Vector3;
  private eyeTiltDeg!: { x: number; y: number };
  private lightSourcePosition!: Vector3;
  private lightSourceTiltDeg!: { x: number; y: number };
  private lightSourceRotationQuaternion!: Quaternion;
  private lightSourceRotationPivot!: Vector3;
  private sortedLensSurfaces: Surface[] = [];
  private sortedEyeSurfaces: Surface[] = [];
  private currentProps!: NormalizedEngineConfig;

  constructor(props: SCAXEngineProps = {}) {
    this.sturm = new Sturm();
    this.configure(props);
  }

  /**
   * 생성자와 동일한 기본값 규칙으로 광학 설정을 다시 적용합니다.
   * 생략한 최상위 필드는 매번 기본값으로 돌아갑니다(이전 값과 병합하지 않음).
   */
  public update(props: SCAXEngineProps = {}) {
    this.configure(props);
  }

  public dispose() {
    [...this.lens, ...this.surfaces].forEach((surface) => {
      surface.clearTraceHistory();
    });
    this.tracedRays = [];
    this.lastSourceRaysForSturm = [];
    this.lastSturmGapAnalysis = null;
    this.surfaces = [];
    this.lens = [];
    this.sortedEyeSurfaces = [];
    this.sortedLensSurfaces = [];
  }

  public getLensSurfacesForDebug() {
    return this.lens;
  }

  public getLightSourceForDebug() {
    return this.light_source;
  }

  public getEyeSurfacesForDebug() {
    return this.surfaces;
  }

  private configure(props: SCAXEngineProps = {}) {
    this.lastSturmGapAnalysis = null;
    const config = normalizeEngineProps(props);
    const model = buildOpticalModel(config, SCAXEngineCore.EYE_ROTATION_PIVOT_FROM_CORNEA_MM);
    this.eyeModel = model.eyeModel;
    this.eyePower = model.eyePower;
    this.eyePrismPrescription = model.eyePrismPrescription;
    this.eyePrismEffectVector = model.eyePrismEffectVector;
    this.eyeTiltDeg = model.eyeTiltDeg;
    this.eyeRotationQuaternion = model.eyeRotationQuaternion;
    this.eyeRotationQuaternionInverse = model.eyeRotationQuaternionInverse;
    this.eyeRotationPivot = model.eyeRotationPivot;
    this.lightSourcePosition = model.lightSourcePosition;
    this.lightSourceTiltDeg = model.lightSourceTiltDeg;
    this.lightSourceRotationQuaternion = model.lightSourceRotationQuaternion;
    this.lightSourceRotationPivot = model.lightSourceRotationPivot;
    this.lensConfigs = model.lensConfigs;
    this.currentProps = config;
    this.lensPowers = model.lensPowers;
    this.lensPrismVector = model.lensPrismVector;
    this.pupilDiameterMm = model.pupilDiameterMm;
    this.eyeModelParameter = model.eyeModelParameter;
    this.surfaces = model.surfaces;
    this.hasPupilStop = model.hasPupilStop;
    this.lens = model.lens;
    this.light_source = model.lightSource;
    this.refreshSortedSurfaces();
  }

  /**
   * 기본 시뮬레이션 진입점입니다.
   * includeSturmData 값과 무관하게 확장 분석(Sturm/retinaPairs)을 항상 포함합니다.
   */
  public simulate(): SimulateResult {
    const tracedRays = this.rayTracing();
    this.sturmCalculation(tracedRays);
    return {
      traced_rays: tracedRays,
      info: buildSimulationInfo({
        eyePower: this.eyePower,
        lensPowers: this.lensPowers,
        lensConfigs: this.lensConfigs,
        eyePrismEffectVector: this.eyePrismEffectVector,
        lensPrismVector: this.lensPrismVector,
      }),
    };
  }

  /**
   * eye.p / eye.p_ax(처방값)를 기준으로, 렌더링에서 바로 쓸 눈 회전량을 반환합니다.
   * - x_deg/y_deg는 프리즘 회전량에 eye.tilt를 합산한 최종 렌더 회전량입니다.
   */
  public getEyeRotation(): EyeRotationForRender {
    // Keep render rotation strictly aligned with the internal eye rotation used in ray tracing.
    // Internal eye-space Euler:
    //   eyeEulerXDeg = eyeRotYDeg + tilt.x
    //   eyeEulerYDeg = (-eyeRotXDeg) + tilt.y
    // UI mapping (applyEyeRenderRotation):
    //   object.rotation.x = -y_deg
    //   object.rotation.y =  x_deg
    // so we expose:
    //   x_deg = eyeEulerYDeg
    //   y_deg = -eyeEulerXDeg
    const eyeRotXDeg = prismComponentToAngleDeg(this.eyePrismEffectVector.x);
    const eyeRotYDeg = prismComponentToAngleDeg(this.eyePrismEffectVector.y);
    const eyeEulerXDeg = eyeRotYDeg + this.eyeTiltDeg.x;
    const eyeEulerYDeg = (-eyeRotXDeg) + this.eyeTiltDeg.y;
    const xDeg = eyeEulerYDeg;
    const yDeg = -eyeEulerXDeg;
    return {
      x_deg: xDeg,
      y_deg: yDeg,
      magnitude_deg: Math.hypot(xDeg, yDeg),
    };
  }

  /**
   * 1) Ray tracing 전용 함수
   * 광원에서 시작한 광선을 표면 순서대로 굴절시켜 최종 광선 집합을 반환합니다.
   */
  public rayTracing(): Ray[] {
    const result = traceRaysThroughOpticalSystem({
      lensSurfaces: this.sortedLensSurfaces,
      eyeSurfaces: this.sortedEyeSurfaces,
      lightSource: this.light_source,
      hasPupilStop: this.hasPupilStop,
      pupilDiameterMm: this.pupilDiameterMm,
      lensPrismVector: this.lensPrismVector,
      eyeRotationQuaternion: this.eyeRotationQuaternion,
      eyeRotationQuaternionInverse: this.eyeRotationQuaternionInverse,
      eyeRotationPivot: this.eyeRotationPivot,
      lightSourcePosition: this.lightSourcePosition,
      lightSourceRotationQuaternion: this.lightSourceRotationQuaternion,
      lightSourceRotationPivot: this.lightSourceRotationPivot,
    });
    this.lastSourceRaysForSturm = result.sourceRaysForSturm;
    this.tracedRays = result.tracedRays;
    return result.tracedRays;
  }



  /**
   * Sturm 선초/근사중심에 사용할 슬라이스 centroid(world z) 구간:
   * 각막 전면(cornea_anterior) 이상 ~ 망막(retina) + 여유 이하.
   */
  private sturmEyeProfileWorldZBounds(): SturmProfileWorldZBounds | undefined {
    let corneaAnteriorZ = Number.POSITIVE_INFINITY;
    let retinaZ = Number.NEGATIVE_INFINITY;
    for (const surface of this.surfaces) {
      const name = surface.getName().toLowerCase();
      const z = Number(surface.getPosition().z);
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

  private surfaceOrderZ(surface: Surface) {
    const z = Number(surface.getPosition().z);
    return Number.isFinite(z) ? z : 0;
  }

  private refreshSortedSurfaces() {
    this.sortedLensSurfaces = [...this.lens].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
    this.sortedEyeSurfaces = [...this.surfaces].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
  }

  private effectiveCylinderFromOpticSurfaces() {
    let j0 = 0;
    let j45 = 0;
    for (const surface of [...this.lens, ...this.surfaces]) {
      const power = surface.getCylinderPower();
      const c = Number(power?.c);
      const ax = Number(power?.ax);
      if (!Number.isFinite(c) || Math.abs(c) < 1e-12 || !Number.isFinite(ax)) continue;
      const v = powerVectorFromCylinder(c, ax);
      j0 += v.j0;
      j45 += v.j45;
    }
    return 2 * Math.hypot(j0, j45);
  }

}

/**
 * 외부 공개 API 전용 Facade입니다.
 * 내부 광학 상태/연산은 SCAXEngineCore에 위임합니다.
 */
export default class SCAXEngine {
  private readonly core: SCAXEngineCore;

  constructor(props: SCAXEngineProps = {}) {
    this.core = new SCAXEngineCore(props);
  }

  // Test/debug bridge for legacy direct field access patterns.
  public get lens() {
    return this.core.getLensSurfacesForDebug();
  }

  public get light_source() {
    return this.core.getLightSourceForDebug();
  }

  public get surfaces() {
    return this.core.getEyeSurfacesForDebug();
  }

  public update(props: SCAXEngineProps = {}) {
    this.core.update(props);
  }

  public dispose() {
    this.core.dispose();
  }

  public simulate(): SimulateResult {
    return this.core.simulate();
  }

  public getEyeRotation(): EyeRotationForRender {
    return this.core.getEyeRotation();
  }

  public rayTracing(): Ray[] {
    return this.core.rayTracing();
  }

  public sturmCalculation(rays?: Ray[]) {
    return this.core.sturmCalculation(rays);
  }
}
