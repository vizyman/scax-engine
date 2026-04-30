import { describe, expect, it } from "vitest";

import SCAXEngine from "../src/scax-engine";

/** test/ui-test/ui-test.html 과 동일한 주경선 고정값(D) */
const CROSS_CYL_MERIDIAN_PLUS_D = 0.25;
const CROSS_CYL_MERIDIAN_MINUS_D = -0.25;
/** ui-test 기본 축(TABO °); GUI·xcylAx 로 변경 가능 */
const CROSS_CYL_AXIS_DEG = 180;

/**
 * ST 규약: 약한 주경선 = s, 강한 주경선 = s + c (TABO 축 기준).
 * @see src/surfaces/paraxial-surface.ts
 */
const PHOROPTER_UI_CROSS_CYLINDER_LENS = {
  s: CROSS_CYL_MERIDIAN_PLUS_D,
  c: CROSS_CYL_MERIDIAN_MINUS_D - CROSS_CYL_MERIDIAN_PLUS_D,
  ax: CROSS_CYL_AXIS_DEG,
  position: { x: 0, y: 0, z: -18 },
  tilt: { x: 0, y: 0 },
} as const;

function principalMeridianPowersD(s: number, c: number): { weak: number; strong: number } {
  return { weak: s, strong: s + c };
}

describe("Cross cylinder (JCC) vs phoropter UI prescription", () => {
  it("ui-test 고정 주경선(+0.25 / −0.25 D)과 동일한 ST 렌즈로 변환된다", () => {
    expect(PHOROPTER_UI_CROSS_CYLINDER_LENS.s).toBe(CROSS_CYL_MERIDIAN_PLUS_D);
    expect(PHOROPTER_UI_CROSS_CYLINDER_LENS.c).toBeCloseTo(
      CROSS_CYL_MERIDIAN_MINUS_D - CROSS_CYL_MERIDIAN_PLUS_D,
      10,
    );
    expect(PHOROPTER_UI_CROSS_CYLINDER_LENS.ax).toBe(CROSS_CYL_AXIS_DEG);
  });

  it("주경선 굴절력이 +F / −F 로 대칭이고 등가구면이 0인 잭슨 크로스 실린더와 일치한다", () => {
    const { s, c } = PHOROPTER_UI_CROSS_CYLINDER_LENS;
    const { weak, strong } = principalMeridianPowersD(s, c);

    expect(weak).toBeCloseTo(CROSS_CYL_MERIDIAN_PLUS_D, 10);
    expect(strong).toBeCloseTo(CROSS_CYL_MERIDIAN_MINUS_D, 10);
    expect(weak + strong).toBeCloseTo(0, 10);

    const sphericalEquivalent = s + c / 2;
    expect(sphericalEquivalent).toBeCloseTo(0, 10);
  });

  it("SCAXEngine 안경 렌즈 배열에 넣었을 때 simulate 난시 요약이 실린더 성분을 반영한다", () => {
    const engine = new SCAXEngine({
      eyeModel: "gullstrand",
      eye: { s: 0, c: 0, ax: 0 },
      lens: [{ ...PHOROPTER_UI_CROSS_CYLINDER_LENS }],
      light_source: { type: "grid", width: 4, height: 4, division: 4, z: -20, vergence: 0 },
    });

    const summary = engine.simulate().info.astigmatism.lens[0] ?? [];
    expect(summary.length).toBe(2);
    const lensCylinderMagnitude = Math.abs(summary[1]!.d - summary[0]!.d);
    expect(lensCylinderMagnitude).toBeCloseTo(Math.abs(PHOROPTER_UI_CROSS_CYLINDER_LENS.c), 10);
  });
});
