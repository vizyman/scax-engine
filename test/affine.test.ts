import { describe, expect, it } from "vitest";

import Affine, { AffinePair } from "../src/affine/affine";

function applyKnownAffine(sx: number, sy: number) {
  // [x'; y'] = [[a b c], [d e f]] * [x y 1]^T
  const a = 1.2;
  const b = -0.3;
  const c = 0.7;
  const d = 0.4;
  const e = 0.9;
  const f = -1.1;
  return {
    tx: a * sx + b * sy + c,
    ty: d * sx + e * sy + f,
    coeffs: { a, b, c, d, e, f },
  };
}

describe("Affine 왜곡 추정", () => {
  it("대응쌍이 4개 미만이면 null을 반환한다", () => {
    const affine = new Affine();
    const pairs: AffinePair[] = [
      { sx: 0, sy: 0, tx: 1, ty: 1 },
      { sx: 1, sy: 0, tx: 2, ty: 1 },
      { sx: 0, sy: 1, tx: 1, ty: 2 },
    ];

    const result = affine.estimate(pairs);

    expect(result).toBeNull();
    expect(affine.getLastResult()).toBeNull();
    expect(affine.getLastPairs()).toEqual(pairs);
  });

  it("잔차가 0에 가까운 정확한 affine 변환을 복원한다", () => {
    const affine = new Affine();
    const sourcePoints = [
      [-2, -1],
      [-1, 2],
      [0, 0],
      [1, -2],
      [2, 1],
      [3, -1],
    ];
    const pairs: AffinePair[] = sourcePoints.map(([sx, sy]) => {
      const transformed = applyKnownAffine(sx, sy);
      return { sx, sy, tx: transformed.tx, ty: transformed.ty };
    });
    const expected = applyKnownAffine(0, 0).coeffs;

    const result = affine.estimate(pairs);

    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(expected.a, 10);
    expect(result!.b).toBeCloseTo(expected.b, 10);
    expect(result!.c).toBeCloseTo(expected.c, 10);
    expect(result!.d).toBeCloseTo(expected.d, 10);
    expect(result!.e).toBeCloseTo(expected.e, 10);
    expect(result!.f).toBeCloseTo(expected.f, 10);
    expect(result!.residualAvgPct).toBeCloseTo(0, 8);
    expect(result!.residualMaxPct).toBeCloseTo(0, 8);
    expect(result!.residuals.length).toBe(0);
  });

  it("비선형 왜곡을 0이 아닌 잔차로 감지한다", () => {
    const affine = new Affine();
    const k = 0.015; // 방사형 왜곡 유사 강도
    const sourcePoints = [
      [-4, -4],
      [-3, 1],
      [-2, 3],
      [-1, -2],
      [1, 2],
      [2, -3],
      [3, 1],
      [4, 4],
      [0, 0],
    ];
    const pairs: AffinePair[] = sourcePoints.map(([sx, sy]) => {
      const base = applyKnownAffine(sx, sy);
      const r2 = sx * sx + sy * sy;
      const distortX = sx * r2 * k;
      const distortY = sy * r2 * k;
      return {
        sx,
        sy,
        tx: base.tx + distortX,
        ty: base.ty + distortY,
      };
    });

    const result = affine.estimate(pairs);

    expect(result).not.toBeNull();
    expect(result!.count).toBe(pairs.length);
    expect(result!.residuals.length).toBeGreaterThan(0);
    expect(result!.residualAvgPct).toBeGreaterThan(0.01);
    expect(result!.residualMaxPct).toBeGreaterThan(result!.residualAvgPct);
  });
});
