import { Vector3 } from "three";
import Affine, { AffinePair } from "./affine/affine";
import {
  GridLightSource,
  GridLightSourceProps,
  LightSource,
  RadialLightSource,
  RadialLightSourceProps,
} from "./light-sources/light-source";
import {
  EYE_ST_SURFACE_OFFSET_MM,
  FRAUNHOFER_REFRACTIVE_INDICES,
  SPECTACLE_VERTEX_DISTANCE_MM,
} from "./parameters/constants";
import { EyeModelParameter } from "./parameters/eye/eyemodel-parameter";
import { GullstrandParameter } from "./parameters/eye/gullstrand-parameter";
import { NavarroParameter } from "./parameters/eye/navarro-parameter";
import Ray from "./ray/ray";
import Sturm from "./sturm/sturm";
import STSurface from "./surfaces/st-surface";
import Surface from "./surfaces/surface";
import DegToTABO from "./utils/deg-to-tabo";
import TABOToDeg from "./utils/tabo-to-deg";

type EyeModel = "gullstrand" | "navarro";

type LightSourceConfig =
  | ({ type: "radial" } & RadialLightSourceProps)
  | ({ type: "grid" } & GridLightSourceProps);

type LensConfig = {
  s: number;
  c: number;
  ax: number;
  position: { x: number; y: number; z: number };
  tilt: { x: number; y: number };
};

export type SCAXEngineProps = {
  eyeModel?: EyeModel;
  eye?: { s: number, c: number, ax: number };
  lens?: LensConfig[];
  light_source?: LightSourceConfig;
  pupilDiameterMm?: number | null;
  pupilPlaneZMm?: number | null;
};

type SimulateResult = {
  traced_rays: Ray[];
  induced_astigmatism: InducedAstigmatismSummary;
};

type SCAxPower = { s: number, c: number, ax: number };
type InducedAstigmatism = { d: number, tabo_deg: number };
type InducedAstigmatismSummary = {
  induced: InducedAstigmatism | null;
  eye: InducedAstigmatism | null;
  lens: InducedAstigmatism | null;
};

/**
 * legacy simulator.js를 TypeScript로 옮긴 핵심 시뮬레이터입니다.
 * - 광원 광선을 생성하고
 * - 표면들을 순서대로 통과시키며 굴절을 계산한 뒤
 * - 망막 대응쌍, Sturm 분석, 왜곡(affine) 분석까지 제공합니다.
 */
export default class SCAXEngine {
  private eyeModel: EyeModel;
  private surfaces: Surface[]; // eye model surfaces
  private lens: Surface[]; // external spectacle lens surfaces
  private light_source: LightSource;
  private eyeModelParameter: EyeModelParameter;
  private tracedRays: Ray[] = [];
  private sturm: Sturm;
  private affine: Affine;
  private lastSturmGapAnalysis: unknown = null;
  private lastAffineAnalysis: unknown = null;
  private pupilDiameterMm: number | null;
  private pupilPlaneZMm: number | null;
  private retinaZMm: number | null;
  private eyePower: SCAxPower;
  private lensConfigs: LensConfig[];
  private lensPowers: SCAxPower[];

  constructor(props: SCAXEngineProps = {}) {
    const {
      eyeModel = "gullstrand",
      eye = { s: 0, c: 0, ax: 0 },
      lens = [],
      light_source = { type: "grid", width: 10, height: 10, division: 4, z: -10, vergence: 0 },
      pupilDiameterMm = null,
      pupilPlaneZMm = null,
    } = props;
    this.eyeModel = eyeModel;
    // eye 입력은 auto refractor(굴절오차) 기준이므로,
    // 광학면에 적용할 때는 보정렌즈 파워 관점으로 부호를 반전합니다.
    this.eyePower = {
      s: -Number(eye?.s ?? 0),
      c: -Number(eye?.c ?? 0),
      ax: Number(eye?.ax ?? 0),
    };
    this.lensConfigs = (Array.isArray(lens) ? lens : []).map((spec) => ({
      s: Number(spec?.s ?? 0),
      c: Number(spec?.c ?? 0),
      ax: Number(spec?.ax ?? 0),
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
    this.lensPowers = this.lensConfigs.map((spec) => ({
      s: Number(spec?.s ?? 0),
      c: Number(spec?.c ?? 0),
      ax: Number(spec?.ax ?? 0),
    }));
    this.eyeModelParameter = eyeModel === "gullstrand" ? new GullstrandParameter() : new NavarroParameter();
    const eyeSt = new STSurface({
      type: "compound",
      name: "eye_st",
      position: { x: 0, y: 0, z: -EYE_ST_SURFACE_OFFSET_MM },
      referencePoint: { x: 0, y: 0, z: 0 },
      tilt: { x: 0, y: 0 },
      s: this.eyePower.s,
      c: this.eyePower.c,
      ax: this.eyePower.ax,
      n_before: FRAUNHOFER_REFRACTIVE_INDICES.air.d,
      n: FRAUNHOFER_REFRACTIVE_INDICES.cornea.d,
      n_after: FRAUNHOFER_REFRACTIVE_INDICES.aqueous.d,
    });
    this.surfaces = [eyeSt, ...this.eyeModelParameter.createSurface()];
    this.lens = this.lensConfigs.map((spec, index) => new STSurface({
      type: "compound",
      name: `lens_st_${index + 1}`,
      position: { x: spec.position.x, y: spec.position.y, z: spec.position.z },
      tilt: { x: spec.tilt.x, y: spec.tilt.y },
      // Spectacle ST rule:
      // 1) back surface is fixed at vertex distance(position.z)
      // 2) back-front gap is optimized (thickness=0 => auto)
      thickness: 0,
      s: Number(spec?.s ?? 0),
      c: Number(spec?.c ?? 0),
      ax: Number(spec?.ax ?? 0),
      n_before: FRAUNHOFER_REFRACTIVE_INDICES.air.d,
      n: FRAUNHOFER_REFRACTIVE_INDICES.crown_glass.d,
      n_after: FRAUNHOFER_REFRACTIVE_INDICES.air.d,
    }));
    this.sturm = new Sturm();
    this.affine = new Affine();
    this.light_source = light_source.type === "radial"
      ? new RadialLightSource(light_source as RadialLightSourceProps)
      : new GridLightSource(light_source as GridLightSourceProps);
    this.pupilDiameterMm = this.toFiniteNumberOrNull(pupilDiameterMm);
    this.pupilPlaneZMm = this.toFiniteNumberOrNull(pupilPlaneZMm);
    this.retinaZMm = this.findRetinaZFromSurfaces();
  }

  /**
   * 기본 시뮬레이션 진입점입니다.
   * includeSturmData 값과 무관하게 확장 분석(Sturm/retinaPairs)을 항상 포함합니다.
   */
  public simulate(): SimulateResult {
    const tracedRays = this.rayTracing();
    return {
      traced_rays: tracedRays,
      induced_astigmatism: this.calculateInducedAstigmatism(this.eyePower, this.lensPowers),
    };
  }

  /**
   * 1) Ray tracing 전용 함수
   * 광원에서 시작한 광선을 표면 순서대로 굴절시켜 최종 광선 집합을 반환합니다.
   */
  public rayTracing(): Ray[] {
    // 안경 렌즈(lens)와 안구 표면(eye model)을 하나의 광학 경로로 합쳐 순차 추적합니다.
    const surfaces = [...this.lens, ...this.surfaces].sort((a, b) => this.surfaceOrderZ(a) - this.surfaceOrderZ(b));
    const sourceRays = this.light_source.emitRays().filter((ray) => this.isRayInsidePupil(ray));
    const traced: Ray[] = [];

    for (const sourceRay of sourceRays) {
      let activeRay = sourceRay.clone();
      let valid = true;
      for (const surface of surfaces) {
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
   * 2) Sturm calculation 전용 함수
   * traced ray 집합에서 z-scan 기반 Sturm 슬라이스/근사 중심을 계산합니다.
   */
  public sturmCalculation(
    rays: Ray[] = this.tracedRays,
  ) {
    this.lastSturmGapAnalysis = this.sturm.calculate(rays, this.effectiveCylinderFromOpticSurfaces());
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

  public getSturmGapAnalysis() {
    return this.lastSturmGapAnalysis;
  }

  public getAffineAnalysis() {
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

  private toFiniteNumberOrNull(value: unknown) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private findRetinaZFromSurfaces() {
    const retinaSurface = this.surfaces.find((surface) => this.readSurfaceName(surface) === "retina");
    const retinaZ = Number(this.readSurfacePosition(retinaSurface as Surface)?.z);
    return Number.isFinite(retinaZ) ? retinaZ : null;
  }

  private isRayInsidePupil(ray: Ray) {
    const diameter = this.pupilDiameterMm;
    if (!Number.isFinite(diameter) || (diameter as number) <= 0) return true;
    const radius = (diameter as number) / 2;
    const points = this.getRayPoints(ray);
    const origin = points[0];
    const direction = ray.getDirection();
    if (!origin || !direction) return false;
    const planeZ = this.pupilPlaneZMm;
    if (!Number.isFinite(planeZ)) return Math.hypot(origin.x, origin.y) <= radius + 1e-6;
    if (Math.abs(direction.z) < 1e-9) return Math.hypot(origin.x, origin.y) <= radius + 1e-6;
    const t = ((planeZ as number) - origin.z) / direction.z;
    if (!Number.isFinite(t) || t < 0) return false;
    const x = origin.x + direction.x * t;
    const y = origin.y + direction.y * t;
    return Math.hypot(x, y) <= radius + 1e-6;
  }

  private powerVectorFromCylinder(cylinderD: number, axisDeg: number) {
    const c = Number(cylinderD);
    const ax = ((Number(axisDeg) % 180) + 180) % 180;
    if (!Number.isFinite(c)) return { j0: 0, j45: 0 };
    const rad = (2 * ax * Math.PI) / 180;
    const scale = -c / 2;
    return { j0: scale * Math.cos(rad), j45: scale * Math.sin(rad) };
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

}
