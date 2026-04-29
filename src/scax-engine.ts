import { Euler, Quaternion, Vector3 } from "three";
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
  EYE_ST_SURFACE_OFFSET_MM,
  FRAUNHOFER_REFRACTIVE_INDICES,
  PUPIL_SIZE,
  RAY_SURFACE_ESCAPE_MM,
  SPECTACLE_VERTEX_DISTANCE_MM,
  ST_POWER_EPS_D,
} from "./parameters/constants";
import { EyeModelParameter } from "./parameters/eye/eyemodel-parameter";
import { GullstrandParameter } from "./parameters/eye/gullstrand-parameter";
import { NavarroParameter } from "./parameters/eye/navarro-parameter";
import Ray from "./ray/ray";
import Sturm from "./sturm/sturm";
import ApertureStopSurface from "./surfaces/aperture-stop-surface";
import STSurface from "./surfaces/st-surface";
import Surface from "./surfaces/surface";
import DegToTABO from "./utils/deg-to-tabo";
import TABOToDeg from "./utils/tabo-to-deg";

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

export type InducedAstigmatism = { d: number; tabo_deg: number };

export type InducedAstigmatismSummary = {
  induced: InducedAstigmatism | null;
  eye: InducedAstigmatism | null;
  lens: InducedAstigmatism | null;
};

export type SimulateResult = {
  traced_rays: Ray[];
  induced_astigmatism: InducedAstigmatismSummary;
  light_deviation: LightDeviation;
};

export type PrismVector = { x: number; y: number; magnitude: number; angle_deg: number };

export type EyeRotationForRender = {
  x_deg: number;
  y_deg: number;
  magnitude_deg: number;
  source_prism: { p: number; p_ax: number };
  source_tilt: { x: number; y: number };
};

export type LightDeviation = {
  eye_prism_effect: PrismVector;
  lens_prism_total: PrismVector;
  net_prism: PrismVector;
  x_angle_deg: number;
  y_angle_deg: number;
  net_angle_deg: number;
};

export type AffineAnalysisResult = ReturnType<Affine["estimate"]>;

/**
 * legacy simulator.js를 TypeScript로 옮긴 핵심 시뮬레이터입니다.
 * - 광원 광선을 생성하고
 * - 표면들을 순서대로 통과시키며 굴절을 계산한 뒤
 * - 망막 대응쌍, Sturm 분석, 왜곡(affine) 분석까지 제공합니다.
 */
export default class SCAXEngine {
  private static readonly EYE_ROTATION_PIVOT_FROM_CORNEA_MM = 13;
  private eyeModel!: EyeModel;
  private surfaces!: Surface[]; // eye model surfaces
  private lens!: Surface[]; // external spectacle lens surfaces
  private light_source!: LightSource;
  private eyeModelParameter!: EyeModelParameter;
  private tracedRays: Ray[] = [];
  private lastSourceRaysForSturm: Ray[] = [];
  private sturm: Sturm;
  private affine: Affine;
  private lastSturmGapAnalysis: ReturnType<Sturm["calculate"]> | null = null;
  private lastAffineAnalysis: ReturnType<Affine["estimate"]> = null;
  private pupilDiameterMm!: number | null;
  private hasPupilStop!: boolean;
  private eyePower!: SCAxPower;
  private lensConfigs!: LensConfig[];
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
  private currentProps!: {
    eyeModel: EyeModel;
    eye: Required<EyeConfig>;
    lens: LensConfig[];
    light_source: LightSourceConfig;
    pupil_type: PupilType;
  };

  constructor(props: SCAXEngineProps = {}) {
    this.sturm = new Sturm();
    this.affine = new Affine();
    this.configure(props);
  }

  /**
   * 생성자와 동일한 기본값 규칙으로 광학 설정을 다시 적용합니다.
   * 생략한 최상위 필드는 매번 기본값으로 돌아갑니다(이전 값과 병합하지 않음).
   */
  public update(props: SCAXEngineProps = {}) {
    this.configure(props);
  }

  private configure(props: SCAXEngineProps = {}) {
    this.lastSturmGapAnalysis = null;
    this.lastAffineAnalysis = null;
    const {
      eyeModel = "gullstrand",
      eye = { s: 0, c: 0, ax: 0, p: 0, p_ax: 0 },
      lens = [],
      light_source = { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      pupil_type = "neutral",
    } = props;
    this.eyeModel = eyeModel;
    const normalizedEyeSphere = Number(eye?.s ?? 0) + (eyeModel === "gullstrand" ? -1 : 0);
    // eye 입력은 auto refractor(굴절오차) 기준이므로,
    // 광학면에 적용할 때는 보정렌즈 파워 관점으로 부호를 반전합니다.
    this.eyePower = {
      s: -normalizedEyeSphere,
      c: -Number(eye?.c ?? 0),
      ax: Number(eye?.ax ?? 0),
    };
    this.eyePrismPrescription = {
      p: this.normalizePrismAmount(eye?.p),
      p_ax: this.normalizeAngle360(eye?.p_ax),
    };
    const eyeRx = this.prismVectorFromBase(this.eyePrismPrescription.p, this.eyePrismPrescription.p_ax);
    // eye 입력은 "교정 필요량(처방값)"이므로 실제 안구 편위는 역벡터입니다.
    this.eyePrismEffectVector = { x: -eyeRx.x, y: -eyeRx.y };
    const eyeRotXDeg = this.prismComponentToAngleDeg(this.eyePrismEffectVector.x);
    const eyeRotYDeg = this.prismComponentToAngleDeg(this.eyePrismEffectVector.y);
    this.eyeTiltDeg = this.normalizeEyeTilt(eye?.tilt);
    const eyeEulerXDeg = (-eyeRotYDeg) + this.eyeTiltDeg.x;
    const eyeEulerYDeg = eyeRotXDeg + this.eyeTiltDeg.y;
    this.eyeRotationQuaternion = new Quaternion().setFromEuler(new Euler(
      (eyeEulerXDeg * Math.PI) / 180,
      (eyeEulerYDeg * Math.PI) / 180,
      0,
      "XYZ",
    ));
    this.eyeRotationQuaternionInverse = this.eyeRotationQuaternion.clone().invert();
    this.eyeRotationPivot = new Vector3(0, 0, SCAXEngine.EYE_ROTATION_PIVOT_FROM_CORNEA_MM);
    const normalizedLightSourcePose = this.normalizeLightSourcePose(light_source);
    this.lightSourcePosition = new Vector3(
      normalizedLightSourcePose.position.x,
      normalizedLightSourcePose.position.y,
      normalizedLightSourcePose.position.z,
    );
    this.lightSourceTiltDeg = { ...normalizedLightSourcePose.tilt };
    this.lightSourceRotationQuaternion = new Quaternion().setFromEuler(new Euler(
      (this.lightSourceTiltDeg.x * Math.PI) / 180,
      (this.lightSourceTiltDeg.y * Math.PI) / 180,
      0,
      "XYZ",
    ));
    // Rotate around the light source local center plane (z), not world origin,
    // so tilt changes orientation without unintentionally translating the source center.
    this.lightSourceRotationPivot = new Vector3(0, 0, Number((light_source as { z?: number })?.z ?? 0));
    this.lensConfigs = (Array.isArray(lens) ? lens : []).map((spec) => ({
      s: Number(spec?.s ?? 0),
      c: Number(spec?.c ?? 0),
      ax: Number(spec?.ax ?? 0),
      p: this.normalizePrismAmount(spec?.p),
      p_ax: this.normalizeAngle360(spec?.p_ax),
      position: {
        x: Number(spec?.position?.x ?? 0),
        y: Number(spec?.position?.y ?? 0),
        z: Number(spec?.position?.z ?? SPECTACLE_VERTEX_DISTANCE_MM),
      },
      tilt: {
        x: Number(spec?.tilt?.x ?? 0),
        y: Number(spec?.tilt?.y ?? 0),
      },
    }));
    this.currentProps = {
      eyeModel,
      eye: {
        s: Number(eye?.s ?? 0),
        c: Number(eye?.c ?? 0),
        ax: Number(eye?.ax ?? 0),
        p: this.normalizePrismAmount(eye?.p),
        p_ax: this.normalizeAngle360(eye?.p_ax),
        tilt: this.normalizeEyeTilt(eye?.tilt),
      },
      lens: this.lensConfigs.map((spec) => ({
        s: Number(spec.s ?? 0),
        c: Number(spec.c ?? 0),
        ax: Number(spec.ax ?? 0),
        p: this.normalizePrismAmount(spec.p),
        p_ax: this.normalizeAngle360(spec.p_ax),
        position: {
          x: Number(spec.position?.x ?? 0),
          y: Number(spec.position?.y ?? 0),
          z: Number(spec.position?.z ?? SPECTACLE_VERTEX_DISTANCE_MM),
        },
        tilt: {
          x: Number(spec.tilt?.x ?? 0),
          y: Number(spec.tilt?.y ?? 0),
        },
      })),
      light_source: {
        ...light_source,
        position: { ...normalizedLightSourcePose.position },
        tilt: { ...normalizedLightSourcePose.tilt },
      } as LightSourceConfig,
      pupil_type,
    };
    this.lensPowers = this.lensConfigs.map((spec) => ({
      s: Number(spec?.s ?? 0),
      c: Number(spec?.c ?? 0),
      ax: Number(spec?.ax ?? 0),
    }));
    // eye/lens prism axis는 모두 임상 Base 방향(렌즈->각막 시점)으로 입력합니다.
    // 내부 광선 편향 벡터는 Base의 반대방향(= +180° 변환)으로 계산합니다.
    this.lensPrismVector = this.lensConfigs.reduce((acc, spec) => {
      const v = this.prismVectorFromBase(spec.p ?? 0, spec.p_ax ?? 0);
      return { x: acc.x + v.x, y: acc.y + v.y };
    }, { x: 0, y: 0 });
    // "none"은 동공 제한을 완전히 비활성화합니다.
    this.pupilDiameterMm = pupil_type === "none" ? 0 : Number(PUPIL_SIZE[pupil_type]);
    this.eyeModelParameter = eyeModel === "gullstrand" ? new GullstrandParameter() : new NavarroParameter();
    const hasEyeCompensationPower = (
      Math.abs(Number(this.eyePower.s) || 0) >= ST_POWER_EPS_D
      || Math.abs(Number(this.eyePower.c) || 0) >= ST_POWER_EPS_D
    );
    this.surfaces = this.eyeModelParameter.createSurface();
    if (hasEyeCompensationPower) {
      const eyeSt = new STSurface({
        type: "compound",
        name: "eye_st",
        position: { x: 0, y: 0, z: -EYE_ST_SURFACE_OFFSET_MM },
        referencePoint: { x: 0, y: 0, z: 0 },
        tilt: { x: 0, y: 0 },
        s: this.eyePower.s,
        c: this.eyePower.c,
        ax: this.eyePower.ax,
        n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
        n: FRAUNHOFER_REFRACTIVE_INDICES.cornea,
        n_after: FRAUNHOFER_REFRACTIVE_INDICES.aqueous,
      });
      this.surfaces = [eyeSt, ...this.surfaces];
    }
    this.hasPupilStop = false;
    if (Number.isFinite(this.pupilDiameterMm) && (this.pupilDiameterMm as number) > 0) {
      const pupilStop = new ApertureStopSurface({
        type: "aperture_stop",
        name: "pupil_stop",
        shape: "circle",
        radius: (this.pupilDiameterMm as number) / 2,
        // eye_st(눈 굴절력 surface)의 첫 굴절면(back vertex) 바로 앞에서 차단/통과를 판정합니다.
        position: {
          x: 0,
          y: 0,
          z: -EYE_ST_SURFACE_OFFSET_MM - (2 * RAY_SURFACE_ESCAPE_MM),
        },
        tilt: { x: 0, y: 0 },
      });
      this.surfaces = [pupilStop, ...this.surfaces];
      this.hasPupilStop = true;
    }
    this.lens = this.lensConfigs.map((spec, index) => new STSurface({
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
      s: Number(spec?.s ?? 0),
      c: Number(spec?.c ?? 0),
      ax: Number(spec?.ax ?? 0),
      n_before: FRAUNHOFER_REFRACTIVE_INDICES.air,
      n: FRAUNHOFER_REFRACTIVE_INDICES.crown_glass,
      n_after: FRAUNHOFER_REFRACTIVE_INDICES.air,
    }));
    this.light_source = light_source.type === "radial"
      ? new RadialLightSource(light_source as RadialLightSourceProps)
      : light_source.type === "grid_rg"
        ? new GridRGLightSource(light_source as GridRGLightSourceProps)
        : new GridLightSource(light_source as GridLightSourceProps);
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
      induced_astigmatism: this.calculateInducedAstigmatism(this.eyePower, this.lensPowers),
      light_deviation: this.calculateLightDeviation(),
    };
  }

  /**
   * eye.p / eye.p_ax(처방값)를 기준으로, 렌더링에서 바로 쓸 눈 회전량을 반환합니다.
   * - source_prism은 사용자 입력(처방값) 그대로
   * - source_tilt는 사용자 입력 eye.tilt(deg) 그대로
   * - x_deg/y_deg는 프리즘 회전량에 eye.tilt를 합산한 최종 렌더 회전량입니다.
   */
  public getEyeRotationForRender(): EyeRotationForRender {
    const rx = this.prismVectorFromBase(this.eyePrismPrescription.p, this.eyePrismPrescription.p_ax);
    const eyeEffect = this.vectorToPrismInfo(rx.x, rx.y);
    const xDeg = this.prismComponentToAngleDeg(eyeEffect.x) + this.eyeTiltDeg.y;
    const yDeg = this.prismComponentToAngleDeg(eyeEffect.y) + this.eyeTiltDeg.x;
    return {
      x_deg: xDeg,
      y_deg: yDeg,
      magnitude_deg: Math.hypot(xDeg, yDeg),
      source_prism: { ...this.eyePrismPrescription },
      source_tilt: { ...this.eyeTiltDeg },
    };
  }

  /**
   * 1) Ray tracing 전용 함수
   * 광원에서 시작한 광선을 표면 순서대로 굴절시켜 최종 광선 집합을 반환합니다.
   */
  public rayTracing(): Ray[] {
    const lensSurfaces = [...this.lens].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
    const eyeSurfaces = [...this.surfaces].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
    eyeSurfaces.forEach((surface) => {
      const maybeImageSurface = surface as unknown as { clearHitPoints?: () => void };
      if (typeof maybeImageSurface.clearHitPoints === "function") maybeImageSurface.clearHitPoints();
    });
    const emittedSourceRays = this.light_source.emitRays().map((ray) => this.applyLightSourceTransformToRay(ray));
    const sourceRays = this.hasPupilStop
      ? emittedSourceRays
      : emittedSourceRays.filter((ray) => this.isRayInsidePupil(ray));
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
      activeRay = this.applyPrismVectorToRay(activeRay, this.lensPrismVector);
      activeRay = this.transformRayAroundPivot(activeRay, this.eyeRotationQuaternionInverse, this.eyeRotationPivot);
      for (const surface of eyeSurfaces) {
        const nextRay = surface.refract(activeRay);
        if (!(nextRay instanceof Ray)) {
          valid = false;
          break;
        }
        activeRay = nextRay;
      }
      activeRay = this.transformRayAroundPivot(activeRay, this.eyeRotationQuaternion, this.eyeRotationPivot);

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
    );
    return this.lastSturmGapAnalysis;
  }

  /**
   * 3) Affine 왜곡 추정 전용 함수
   * 광선 대응쌍(sx,sy)->(tx,ty)에 대해 최소자승 2D affine을 적합합니다.
   */
  public estimateAffineDistortion(pairs: AffinePair[]) {
    const inputPairs = Array.isArray(pairs) ? pairs : [];
    this.lastAffineAnalysis = this.affine.estimate(inputPairs);
    return this.lastAffineAnalysis;
  }

  /**
   * 기존 API 호환용 별칭입니다.
   */
  public affine2d(pairs: AffinePair[]) {
    return this.estimateAffineDistortion(pairs);
  }

  /**
   * 현재 eye+lens 설정 기준 affine 왜곡 결과를 반환합니다.
   * traced ray/affine 결과는 기존 계산값을 우선 재사용합니다.
   */
  public getAffineAnalysis(): AffineAnalysisResult {
    if (!this.tracedRays.length) {
      this.simulate();
    }
    if (!this.lastAffineAnalysis) {
      this.lastAffineAnalysis = this.estimateAffineDistortion(this.createAffinePairs(this.tracedRays));
    }
    return this.lastAffineAnalysis;
  }

  /**
   * 눈 도수와 안경 도수를 합성했을 때의 유발난시를 계산합니다.
   * - 입력 축(ax)은 TABO(deg) 기준으로 해석합니다.
   * - 결과는 { induced, eye, lens }를 반환합니다.
   * - 각 항목은 { d, tabo_deg } 형태이며, 난시가 없으면 null을 반환합니다.
   */
  public calculateInducedAstigmatism(
    eye: SCAxPower,
    lens: SCAxPower | SCAxPower[],
  ): InducedAstigmatismSummary {
    const lensList = Array.isArray(lens) ? lens : [lens];
    const toAstigmatism = (powers: SCAxPower[]): InducedAstigmatism | null => {
      let j0 = 0;
      let j45 = 0;

      for (const power of powers) {
        const cylinder = Number(power?.c ?? 0);
        const axisTABO = Number(power?.ax ?? 0);
        if (!Number.isFinite(cylinder) || !Number.isFinite(axisTABO) || Math.abs(cylinder) < 1e-12) continue;
        const axisDeg = TABOToDeg(axisTABO);
        const rad = (2 * axisDeg * Math.PI) / 180;
        const scale = -cylinder / 2;
        j0 += scale * Math.cos(rad);
        j45 += scale * Math.sin(rad);
      }

      const d = 2 * Math.hypot(j0, j45);
      if (!Number.isFinite(d) || d < 1e-9) return null;

      const axisDeg = (((0.5 * Math.atan2(j45, j0) * 180) / Math.PI) % 180 + 180) % 180;
      return {
        d,
        tabo_deg: DegToTABO(axisDeg),
      };
    };

    return {
      induced: toAstigmatism([eye, ...lensList]),
      eye: toAstigmatism([eye]),
      lens: toAstigmatism(lensList),
    };
  }

  private surfaceOrderZ(surface: Surface) {
    const z = Number(this.readSurfacePosition(surface)?.z);
    return Number.isFinite(z) ? z : 0;
  }

  private readSurfaceName(surface: Surface) {
    return (surface as unknown as { name?: string }).name;
  }

  private readSurfacePosition(surface: Surface) {
    return (surface as unknown as { position?: Vector3 }).position;
  }

  private getRayPoints(ray: Ray) {
    const points = (ray as unknown as { points?: Vector3[] }).points;
    return Array.isArray(points) ? points : [];
  }

  private isRayInsidePupil(ray: Ray) {
    const diameter = this.pupilDiameterMm;
    if (!Number.isFinite(diameter) || (diameter as number) <= 0) return true;
    const radius = (diameter as number) / 2;
    const points = this.getRayPoints(ray);
    const origin = points[0];
    if (!origin) return false;
    return Math.hypot(origin.x, origin.y) <= radius + 1e-6;
  }

  private powerVectorFromCylinder(cylinderD: number, axisDeg: number) {
    const c = Number(cylinderD);
    const ax = ((Number(axisDeg) % 180) + 180) % 180;
    if (!Number.isFinite(c)) return { j0: 0, j45: 0 };
    const rad = (2 * ax * Math.PI) / 180;
    const scale = -c / 2;
    return { j0: scale * Math.cos(rad), j45: scale * Math.sin(rad) };
  }

  private normalizePrismAmount(value: unknown) {
    const p = Number(value ?? 0);
    return Number.isFinite(p) ? Math.max(0, p) : 0;
  }

  private normalizeAngle360(value: unknown) {
    const d = Number(value ?? 0);
    if (!Number.isFinite(d)) return 0;
    return ((d % 360) + 360) % 360;
  }

  private normalizeEyeTilt(value: EyeConfig["tilt"]) {
    return {
      x: Number(value?.x ?? 0),
      y: Number(value?.y ?? 0),
    };
  }

  private normalizeLightSourcePose(value: LightSourceConfig) {
    return {
      position: {
        x: Number(value?.position?.x ?? 0),
        y: Number(value?.position?.y ?? 0),
        z: Number(value?.position?.z ?? 0),
      },
      tilt: {
        x: Number(value?.tilt?.x ?? 0),
        y: Number(value?.tilt?.y ?? 0),
      },
    };
  }

  private prismVectorFromBase(prismDiopter: number, baseAngleDeg: number) {
    const p = this.normalizePrismAmount(prismDiopter);
    const baseAngle = this.normalizeAngle360(baseAngleDeg);
    // Clinical Base convention:
    // - input axis is prism base direction, viewed from lens side toward cornea (OD: right=0°)
    // - light deviation is opposite to base, so internally convert by +180°
    const deviationAngle = this.normalizeAngle360(baseAngle + 180);
    // Internal x/y uses math-style +x right, +y up.
    // Because user axis is defined from lens->cornea view, flip angular direction by negating theta.
    const rad = (-deviationAngle * Math.PI) / 180;
    return {
      x: p * Math.cos(rad),
      y: p * Math.sin(rad),
    };
  }

  private vectorToPrismInfo(x: number, y: number): PrismVector {
    const xx = Number.isFinite(x) ? x : 0;
    const yy = Number.isFinite(y) ? y : 0;
    const magnitude = Math.hypot(xx, yy);
    const angleDeg = this.normalizeAngle360((Math.atan2(yy, xx) * 180) / Math.PI);
    return {
      x: xx,
      y: yy,
      magnitude,
      angle_deg: magnitude < 1e-12 ? 0 : angleDeg,
    };
  }

  private prismComponentToAngleDeg(componentPrism: number) {
    const c = Number(componentPrism);
    if (!Number.isFinite(c)) return 0;
    return (Math.atan(c / 100) * 180) / Math.PI;
  }

  private prismMagnitudeToAngleDeg(prismDiopter: number) {
    const p = Number(prismDiopter);
    if (!Number.isFinite(p) || p < 1e-12) return 0;
    return (Math.atan(p / 100) * 180) / Math.PI;
  }

  private applyPrismVectorToRay(ray: Ray, prism: { x: number; y: number }) {
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

  private rotatePointAroundPivot(point: Vector3, rotation: Quaternion, pivot: Vector3) {
    return point.clone().sub(pivot).applyQuaternion(rotation).add(pivot);
  }

  private translateRay(ray: Ray, offset: Vector3) {
    if (offset.lengthSq() < 1e-12) return ray;
    const points = this.getRayPoints(ray);
    if (!points.length) return ray;
    const translated = ray.clone();
    const translatedState = translated as unknown as {
      points?: Vector3[];
      origin?: Vector3;
    };
    const nextPoints = points.map((point) => point.clone().add(offset));
    translatedState.points = nextPoints;
    translatedState.origin = nextPoints[nextPoints.length - 1].clone();
    return translated;
  }

  private transformRayAroundPivot(ray: Ray, rotation: Quaternion, pivot: Vector3) {
    const points = this.getRayPoints(ray);
    if (!points.length) return ray;
    const transformed = ray.clone();
    const transformedState = transformed as unknown as {
      points?: Vector3[];
      direction?: Vector3;
      origin?: Vector3;
    };
    const nextPoints = points.map((point) => this.rotatePointAroundPivot(point, rotation, pivot));
    transformedState.points = nextPoints;
    transformedState.direction = ray.getDirection().clone().applyQuaternion(rotation).normalize();
    transformedState.origin = nextPoints[nextPoints.length - 1].clone();
    return transformed;
  }

  private applyLightSourceTransformToRay(ray: Ray) {
    const rotated = this.transformRayAroundPivot(
      ray,
      this.lightSourceRotationQuaternion,
      this.lightSourceRotationPivot,
    );
    return this.translateRay(rotated, this.lightSourcePosition);
  }

  private calculateLightDeviation(): LightDeviation {
    // eye/lens 입력은 모두 임상 Base 방향이므로, prismVectorFromBase 내부에서
    // Base -> 광선편향(+180°) 변환이 적용됩니다.
    // eye는 "처방값(교정 필요량)"으로 해석하므로 실제 눈 편위는 역벡터입니다.
    const eyeEffect = this.vectorToPrismInfo(this.eyePrismEffectVector.x, this.eyePrismEffectVector.y);
    // lens 입력은 교정량이며, 렌즈는 Base 반대방향으로 광선을 실제 굴절시킵니다.
    // prismVectorFromBase에서 Base->광선편향이 이미 반영된 벡터를 그대로 합산합니다.
    const lensX = this.lensPrismVector.x;
    const lensY = this.lensPrismVector.y;
    const lensTotal = this.vectorToPrismInfo(lensX, lensY);
    const net = this.vectorToPrismInfo(eyeEffect.x + lensTotal.x, eyeEffect.y + lensTotal.y);
    return {
      eye_prism_effect: eyeEffect,
      lens_prism_total: lensTotal,
      net_prism: net,
      x_angle_deg: this.prismComponentToAngleDeg(net.x),
      y_angle_deg: this.prismComponentToAngleDeg(net.y),
      net_angle_deg: this.prismMagnitudeToAngleDeg(net.magnitude),
    };
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
