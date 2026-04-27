import { describe, expect, it } from "vitest";

import DegToTABO from "../src/utils/deg-to-tabo";
import TABOToDeg from "../src/utils/tabo-to-deg";

describe("각도 변환 헬퍼", () => {
  it("경계값과 범위를 벗어난 값을 [0, 180)으로 정규화한다", () => {
    const samples = [0, 180, -30, 540, 721.2];
    for (const sample of samples) {
      const deg = TABOToDeg(sample);
      const tabo = DegToTABO(sample);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(180);
      expect(tabo).toBeGreaterThanOrEqual(0);
      expect(tabo).toBeLessThan(180);
    }
  });

  it("정규화 규칙 안에서 왕복 변환 일관성을 유지한다", () => {
    const samples = [0, 12.5, 44, 90, 135, 179.999];
    for (const sample of samples) {
      const roundTrip = TABOToDeg(DegToTABO(sample));
      const normalized = ((sample % 180) + 180) % 180;
      expect(roundTrip).toBeCloseTo(normalized, 8);
    }
  });

  it("유효하지 않은 숫자 입력에는 0을 반환한다", () => {
    expect(DegToTABO(Number.NaN)).toBe(0);
    expect(TABOToDeg(Number.NaN)).toBe(0);
    expect(DegToTABO(Number.POSITIVE_INFINITY)).toBe(0);
    expect(TABOToDeg(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
