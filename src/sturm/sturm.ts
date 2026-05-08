import { Vector3 } from "three";
import {
  DEFAULT_EFFECTIVE_CYLINDER_THRESHOLD_D,
  DEFAULT_STURM_STEP_MM,
  DEFAULT_STURM_TOP2_AXIS_LAST_RESORT_MIN_GAP_DEG,
  DEFAULT_STURM_TOP2_MIN_ANGLE_GAP_DEG,
  DEFAULT_STURM_TOP2_MIN_GAP_MM,
  DEFAULT_STURM_TOP2_PHASOR_FALLBACK_MAX_DOT,
  DEFAULT_STURM_TOP2_PHASOR_OPPOSITION_MAX_DOT,
} from "../parameters/constants";
import Ray from "../ray/ray";

/** Sturm 선초 분석에 사용할 슬라이스 centroid(world) z 구간 [zMin, zMax] (mm) */
export type SturmProfileWorldZBounds = { zMin: number; zMax: number };

type FraunhoferLine = "g" | "F" | "e" | "d" | "C" | "r";

type SturmSlice = {
  z: number;
  depth: number;
  ratio: number;
  size: number;
  profile: {
    at: { x: number; y: number; z: number };
    wMajor: number;
    wMinor: number;
    angleMajorDeg: number;
    /** 이각 공간 난시 phasor: (cos 2θ, sin 2θ), θ = 주경선 각(rad) */
    j0: number;
    j45: number;
    angleMinorDeg: number;
    majorDirection: { x: number; y: number; z: number };
    minorDirection: { x: number; y: number; z: number };
  };
};

/**
 * Sturm 계산 전용 클래스입니다.
 * - traced ray 집합에서 z-scan slice를 생성하고
 * - 평탄도/최소타원/근사중심을 계산해 분석 결과를 반환합니다.
 */
export default class Sturm {
  private lastResult: unknown = null;

  public calculate(
    rays: Ray[],
    effectiveCylinderD: number,
    axisReferenceRays?: Ray[],
    profileWorldZBounds?: SturmProfileWorldZBounds | null,
  ) {
    const frame = this.analysisFrameFromRays(axisReferenceRays?.length ? axisReferenceRays : rays);
    const depthRange = this.depthRangeFromRays(rays, frame);
    const sturmSlices = this.collectSturmSlices(rays, frame, depthRange, DEFAULT_STURM_STEP_MM);
    const groupedByLine = this.groupByFraunhoferLine(rays);
    const sturmInfo = groupedByLine.map((group) => {
      const groupFrame = this.analysisFrameFromRays(group.rays, frame);
      const groupDepthRange = this.depthRangeFromRays(group.rays, groupFrame);
      const slices = this.collectSturmSlices(group.rays, groupFrame, groupDepthRange, DEFAULT_STURM_STEP_MM);
      const analysis = this.analyzeSturmSlices(slices, effectiveCylinderD, profileWorldZBounds);
      return {
        line: group.line,
        wavelength_nm: group.wavelength_nm,
        color: group.color,
        ray_count: group.rays.length,
        analysis_axis: {
          x: groupFrame.axis.x,
          y: groupFrame.axis.y,
          z: groupFrame.axis.z,
        },
        ...analysis,
      };
    });
    const result = {
      slices_info: {
        count: sturmSlices.length,
        slices: sturmSlices,
      },
      sturm_info: sturmInfo,
    };
    this.lastResult = result;
    return result;
  }

  /**
   * 마지막 Sturm 계산 결과를 반환합니다.
   */
  public getLastResult() {
    return this.lastResult;
  }

  private getRayPoints(ray: Ray) {
    const points = (ray as unknown as { points?: Vector3[] }).points;
    return Array.isArray(points) ? points : [];
  }

  private readonly lineOrder: FraunhoferLine[] = ["g", "F", "e", "d", "C", "r"];

  private analysisFrameFromRays(
    rays: Ray[],
    fallback?: { origin: Vector3; axis: Vector3; u: Vector3; v: Vector3 },
  ) {
    const axis = new Vector3();
    for (const ray of rays ?? []) axis.add(ray.getDirection());
    if (axis.lengthSq() < 1e-12) {
      if (fallback) return fallback;
      axis.set(0, 0, 1);
    } else {
      axis.normalize();
    }

    const origin = new Vector3(0, 0, 0);
    let helper = new Vector3(0, 1, 0);
    if (Math.abs(helper.dot(axis)) > 0.95) helper = new Vector3(1, 0, 0);
    const u = helper.clone().cross(axis).normalize();
    const v = axis.clone().cross(u).normalize();
    return { origin, axis, u, v };
  }

  private sampleRayPointAtDepth(
    ray: Ray,
    frame: { origin: Vector3; axis: Vector3 },
    depth: number,
  ) {
    const points = this.getRayPoints(ray);
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const da = a.clone().sub(frame.origin).dot(frame.axis);
      const db = b.clone().sub(frame.origin).dot(frame.axis);
      if ((da <= depth && depth <= db) || (db <= depth && depth <= da)) {
        const denom = db - da;
        if (Math.abs(denom) < 1e-10) return null;
        return a.clone().lerp(b, (depth - da) / denom);
      }
    }
    return null;
  }

  private depthRangeFromRays(rays: Ray[], frame: { origin: Vector3; axis: Vector3 }) {
    let depthMin = Number.POSITIVE_INFINITY;
    let depthMax = Number.NEGATIVE_INFINITY;
    for (const ray of rays ?? []) {
      for (const point of this.getRayPoints(ray)) {
        const d = point.clone().sub(frame.origin).dot(frame.axis);
        depthMin = Math.min(depthMin, d);
        depthMax = Math.max(depthMax, d);
      }
    }
    if (!Number.isFinite(depthMin) || !Number.isFinite(depthMax) || depthMax <= depthMin) return null;
    return { depthMin, depthMax };
  }

  private secondMomentProfileAtDepth(
    rays: Ray[],
    frame: { origin: Vector3; axis: Vector3; u: Vector3; v: Vector3 },
    depth: number,
  ) {
    const points: Vector3[] = [];
    for (const ray of rays) {
      const point = this.sampleRayPointAtDepth(ray, frame, depth);
      if (point) points.push(point);
    }
    if (points.length < 4) return null;

    let cxWorld = 0;
    let cyWorld = 0;
    let czWorld = 0;
    let cx = 0;
    let cy = 0;
    for (const p of points) {
      cxWorld += p.x;
      cyWorld += p.y;
      czWorld += p.z;
      const delta = p.clone().sub(frame.origin);
      cx += delta.dot(frame.u);
      cy += delta.dot(frame.v);
    }
    cxWorld /= points.length;
    cyWorld /= points.length;
    czWorld /= points.length;
    cx /= points.length;
    cy /= points.length;

    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const p of points) {
      const delta = p.clone().sub(frame.origin);
      const x = delta.dot(frame.u);
      const y = delta.dot(frame.v);
      const dx = x - cx;
      const dy = y - cy;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    sxx /= points.length;
    syy /= points.length;
    sxy /= points.length;

    const trace = sxx + syy;
    const halfDiff = (sxx - syy) / 2;
    const root = Math.sqrt(Math.max(0, halfDiff * halfDiff + sxy * sxy));
    const lambdaMajor = Math.max(0, trace / 2 + root);
    const lambdaMinor = Math.max(0, trace / 2 - root);
    const thetaRad = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const angleMajorDeg = ((thetaRad * 180) / Math.PI + 360) % 180;
    const twoThetaRad = 2 * thetaRad;
    const j0 = Math.cos(twoThetaRad);
    const j45 = Math.sin(twoThetaRad);
    const majorDirection = frame.u.clone().multiplyScalar(Math.cos(thetaRad))
      .add(frame.v.clone().multiplyScalar(Math.sin(thetaRad)))
      .normalize();
    const minorDirection = frame.axis.clone().cross(majorDirection).normalize();

    return {
      at: { x: cxWorld, y: cyWorld, z: czWorld },
      wMajor: Math.sqrt(lambdaMajor),
      wMinor: Math.sqrt(lambdaMinor),
      angleMajorDeg,
      j0,
      j45,
      angleMinorDeg: (angleMajorDeg + 90) % 180,
      majorDirection: {
        x: majorDirection.x,
        y: majorDirection.y,
        z: majorDirection.z,
      },
      minorDirection: {
        x: minorDirection.x,
        y: minorDirection.y,
        z: minorDirection.z,
      },
    };
  }

  private collectSturmSlices(
    rays: Ray[],
    frame: { origin: Vector3; axis: Vector3; u: Vector3; v: Vector3 },
    depthRange: { depthMin: number; depthMax: number } | null,
    stepMm: number,
  ): SturmSlice[] {
    if (!depthRange) return [];
    const out: SturmSlice[] = [];
    for (let depth = depthRange.depthMin; depth <= depthRange.depthMax; depth += stepMm) {
      const profile = this.secondMomentProfileAtDepth(rays, frame, depth);
      if (!profile) continue;
      out.push({
        // Keep z in world coordinates for backward-compatible consumers.
        z: profile.at.z,
        // Preserve analysis-axis depth for off-axis robust ranking/interval logic.
        depth,
        ratio: profile.wMinor / Math.max(profile.wMajor, 1e-9),
        size: Math.hypot(profile.wMajor, profile.wMinor),
        profile,
      });
    }
    return out;
  }

  private axisDiffDeg(a: number, b: number) {
    const d = Math.abs((((a - b) % 180) + 180) % 180);
    return Math.min(d, 180 - d);
  }

  private phasorDot(
    p: { j0: number; j45: number },
    q: { j0: number; j45: number },
  ) {
    return p.j0 * q.j0 + p.j45 * q.j45;
  }

  /**
   * 평탄도 순으로 정렬된 슬라이스에서 선초점 쌍(직교 주경선)에 해당하는 Top2를 고른다.
   * 주경선 각 대신 이각 phasor (cos 2θ, sin 2θ)로 직교를 판정하고, 실패 시 각도·전역 검색·깊이 폴백을 사용한다.
   */
  private pickFlattestSturmPair(
    sortedByFlatness: SturmSlice[],
    top2MinGapMm: number,
    allSlices: SturmSlice[],
  ): SturmSlice[] {
    if (sortedByFlatness.length === 0) return [];

    const first = sortedByFlatness[0];
    const top2MinAngleGapDeg = DEFAULT_STURM_TOP2_MIN_ANGLE_GAP_DEG;
    const phasorStrict = DEFAULT_STURM_TOP2_PHASOR_OPPOSITION_MAX_DOT;
    const phasorLoose = DEFAULT_STURM_TOP2_PHASOR_FALLBACK_MAX_DOT;
    const lastResortMinDeg = DEFAULT_STURM_TOP2_AXIS_LAST_RESORT_MIN_GAP_DEG;

    const depthOk = (c: SturmSlice) => Math.abs(c.depth - first.depth) >= top2MinGapMm;

    const byPhasor = (pool: SturmSlice[], maxDot: number) => pool.find((c) => (
      c !== first
      && depthOk(c)
      && this.phasorDot(first.profile, c.profile) <= maxDot
    ));

    let second = byPhasor(sortedByFlatness, phasorStrict)
      ?? byPhasor(sortedByFlatness, phasorLoose);

    if (!second) {
      second = sortedByFlatness.find((c) => (
        c !== first
        && depthOk(c)
        && this.axisDiffDeg(c.profile.angleMajorDeg, first.profile.angleMajorDeg) >= top2MinAngleGapDeg
      ));
    }

    if (!second) {
      let best: SturmSlice | null = null;
      let bestAxDiff = -1;
      for (const c of sortedByFlatness) {
        if (c === first || !depthOk(c)) continue;
        const axd = this.axisDiffDeg(c.profile.angleMajorDeg, first.profile.angleMajorDeg);
        if (axd > bestAxDiff) {
          bestAxDiff = axd;
          best = c;
        }
      }
      if (best && bestAxDiff >= lastResortMinDeg) second = best;
    }

    // 평탄도 정렬 풀만으로는 같은 phasor만 연속으로 나오는 경우가 있어, 전 스캔에서 가장 반대인 phasor를 고른다.
    if (!second) {
      let best: SturmSlice | null = null;
      let bestDot = 1;
      for (const c of allSlices) {
        if (c === first || !depthOk(c)) continue;
        const d = this.phasorDot(first.profile, c.profile);
        if (d < bestDot) {
          bestDot = d;
          best = c;
        }
      }
      if (best && bestDot < -0.08) second = best;
    }

    // 마지막: 가장 납작한 슬라이스와 깊이 차가 가장 큰 “비교적 납작한” 슬라이스 (선초점이 z로 분리될 때)
    if (!second) {
      const flatThreshold = first.ratio * 1.5 + 1e-6;
      let best: SturmSlice | null = null;
      let bestDepthSpan = -1;
      for (const c of allSlices) {
        if (c === first || !depthOk(c)) continue;
        if (c.ratio > flatThreshold) continue;
        const span = Math.abs(c.depth - first.depth);
        if (span > bestDepthSpan) {
          bestDepthSpan = span;
          best = c;
        }
      }
      if (best) second = best;
    }

    return second ? [first, second] : [first];
  }

  private buildApproxCenter(
    flattestTop2: Array<{ z: number; profile: { at: { x: number; y: number } } }>,
    smallestEllipse: { z: number; profile: { at: { x: number; y: number } } } | null,
    preferTop2Mid: boolean,
  ) {
    if (flattestTop2.length <= 0) return null;
    if (preferTop2Mid && flattestTop2.length >= 2) {
      const first = flattestTop2[0];
      const second = flattestTop2[1];
      return {
        x: (first.profile.at.x + second.profile.at.x) / 2,
        y: (first.profile.at.y + second.profile.at.y) / 2,
        z: (first.z + second.z) / 2,
        mode: "top2-mid",
      };
    }
    if (smallestEllipse) {
      return {
        x: smallestEllipse.profile.at.x,
        y: smallestEllipse.profile.at.y,
        z: smallestEllipse.z,
        mode: "min-size",
      };
    }
    const first = flattestTop2[0];
    return { x: first.profile.at.x, y: first.profile.at.y, z: first.z, mode: "top1-flat" };
  }

  private slicesForSturmAnalysis(
    sturmSlices: SturmSlice[],
    bounds: SturmProfileWorldZBounds | null | undefined,
  ): SturmSlice[] {
    if (!bounds) return sturmSlices;
    const zMin = bounds.zMin;
    const zMax = bounds.zMax;
    if (!Number.isFinite(zMin) || !Number.isFinite(zMax) || zMax < zMin) return sturmSlices;
    const bounded = sturmSlices.filter((s) => {
      const z = s.profile?.at?.z;
      return Number.isFinite(z) && z >= zMin && z <= zMax;
    });
    return bounded.length >= 2 ? bounded : sturmSlices;
  }

  private groupByFraunhoferLine(rays: Ray[]) {
    const groups = new Map<FraunhoferLine, {
      line: FraunhoferLine;
      wavelength_nm: number;
      color: number | null;
      rays: Ray[];
    }>();
    for (const ray of rays) {
      const line = ray.getFraunhoferLine() as FraunhoferLine;
      const wavelength = ray.getWavelengthNm();
      const color = Number((ray as unknown as { displayColor?: number }).displayColor);
      if (!groups.has(line)) {
        groups.set(line, {
          line,
          wavelength_nm: wavelength,
          color: Number.isFinite(color) ? color : null,
          rays: [],
        });
      }
      const group = groups.get(line);
      if (group) group.rays.push(ray);
    }
    return [...groups.values()].sort((a, b) => this.lineOrder.indexOf(a.line) - this.lineOrder.indexOf(b.line));
  }

  private analyzeSturmSlices(
    sturmSlices: SturmSlice[],
    effectiveCylinderD: number,
    profileWorldZBounds?: SturmProfileWorldZBounds | null,
  ) {
    const top2MinGapMm = DEFAULT_STURM_TOP2_MIN_GAP_MM;
    const effectiveCylinderThresholdD = DEFAULT_EFFECTIVE_CYLINDER_THRESHOLD_D;
    const preferTop2Mid = effectiveCylinderD >= effectiveCylinderThresholdD;
    const slicesForAnalysis = this.slicesForSturmAnalysis(sturmSlices, profileWorldZBounds ?? null);
    const sortedByFlatness = [...slicesForAnalysis].sort((a, b) => a.ratio - b.ratio);
    const flattestTop2 = sortedByFlatness.length > 0
      ? this.pickFlattestSturmPair(sortedByFlatness, top2MinGapMm, slicesForAnalysis)
      : [];

    let smallestEllipse: SturmSlice | null = null;
    for (const slice of slicesForAnalysis) {
      if (!smallestEllipse || slice.size < smallestEllipse.size) smallestEllipse = slice;
    }

    const approxCenter = this.buildApproxCenter(flattestTop2, smallestEllipse, preferTop2Mid);
    const anterior = flattestTop2[0] ?? null;
    const posterior = preferTop2Mid ? (flattestTop2[1] ?? null) : null;
    return {
      has_astigmatism: preferTop2Mid,
      method: preferTop2Mid ? "sturm-interval-midpoint" : "minimum-ellipse",
      anterior,
      posterior,
      approx_center: approxCenter,
    };
  }
}
